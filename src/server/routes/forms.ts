import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context, redis, reddit } from '@devvit/web/server';
import type { PlaceStatus } from '../../shared/types.js';
import {
  isDiscipline,
  isImpact,
  validateDisciplines,
  validateImpacts,
  canOverrideTagSource,
  type Discipline,
  type Impact,
  type TagSource,
} from '../../shared/taxonomy.js';
import { resolvePlace, toPlaceLocation } from '../core/placeResolver.js';
import {
  getGalleryItem,
  updateGalleryItemLocation,
  updateGalleryItemTags,
  type RedisClientContract,
} from '../data/galleryStore.js';
import { defaultModeratorChecker, type ModeratorChecker } from './api.js';

type ExampleFormValues = {
  message?: string;
};

export type TagLocationFormPayload = {
  location?: string;
  takenDate?: string;
  postId?: string;
  disciplines?: string | string[];
  impacts?: string | string[];
};

const getCallerUsername = async (): Promise<string | undefined> => {
  try {
    if (context.username) {
      return context.username;
    }
  } catch {
    // outside request
  }
  try {
    const name = await reddit.getCurrentUsername();
    return name ?? undefined;
  } catch {
    return undefined;
  }
};

const getSubredditNameSafely = (): string | undefined => {
  try {
    return context.subredditName;
  } catch {
    return undefined;
  }
};

const parseArrayOrCsv = (val?: string | string[]): string[] => {
  if (Array.isArray(val)) {
    return val.map((s) => s.trim()).filter((s) => s.length > 0);
  }
  if (typeof val === 'string') {
    return val
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return [];
};

export type CallerResolver = () => Promise<string | undefined>;

export const createFormsRouter = (
  redisClient: RedisClientContract = redis,
  isModerator: ModeratorChecker = defaultModeratorChecker,
  getCaller: CallerResolver = getCallerUsername
): Hono => {
  const router = new Hono();

  router.post('/example-submit', async (c) => {
    const { message } = await c.req.json<ExampleFormValues>();
    const trimmedMessage = typeof message === 'string' ? message.trim() : '';

    return c.json<UiResponse>(
      {
        showToast: trimmedMessage
          ? `Form says: ${trimmedMessage}`
          : 'Form submitted with no message',
      },
      200
    );
  });

  router.post('/tag-location', async (c) => {
    try {
      const payload = await c.req.json<TagLocationFormPayload>();
      const locationInput = payload.location?.trim() || '';

      let targetPostId = payload.postId?.trim();
      if (!targetPostId) {
        try {
          targetPostId = context.postId;
        } catch {
          // outside request context
        }
      }

      if (!targetPostId) {
        return c.json<UiResponse>(
          { showToast: 'Unable to tag location: missing post ID' },
          400
        );
      }

      const disciplinesProvided = payload.disciplines !== undefined;
      const impactsProvided = payload.impacts !== undefined;

      if (!locationInput && !disciplinesProvided && !impactsProvided) {
        return c.json<UiResponse>(
          { showToast: 'Please provide a location name' },
          400
        );
      }

      const item = await getGalleryItem(targetPostId, redisClient);
      if (!item) {
        return c.json<UiResponse>(
          { showToast: 'Post not found in photo gallery' },
          404
        );
      }

      // Permissions: Post author or subreddit moderator
      const caller = await getCaller();
      const subreddit = getSubredditNameSafely();
      const isAuthor =
        caller !== undefined &&
        item.author.toLowerCase() === caller.toLowerCase();
      const isMod = await isModerator(caller, subreddit);

      if (!isAuthor && !isMod) {
        return c.json<UiResponse>(
          { showToast: 'Only the author or moderators can tag this location' },
          403
        );
      }

      const tagSource: TagSource = isMod ? 'mod-verified' : 'poster-tagged';

      // Validate disciplines if provided
      let validDisciplines: Discipline[] = [];
      if (disciplinesProvided) {
        const rawDisciplines = parseArrayOrCsv(payload.disciplines);
        if (rawDisciplines.some((d) => !isDiscipline(d))) {
          return c.json<UiResponse>(
            {
              showToast:
                'Invalid discipline: must be one of Electromagnetics, Mechanics, Biology, Mathematics, Arts, Materials',
            },
            400
          );
        }
        if (!canOverrideTagSource(item.disciplinesSource, tagSource)) {
          return c.json<UiResponse>(
            {
              showToast:
                'Cannot override moderator-verified discipline tags',
            },
            403
          );
        }
        validDisciplines = validateDisciplines(rawDisciplines);
      }

      // Validate impacts if provided
      let validImpacts: Impact[] = [];
      if (impactsProvided) {
        const rawImpacts = parseArrayOrCsv(payload.impacts);
        if (rawImpacts.some((imp) => !isImpact(imp))) {
          return c.json<UiResponse>(
            {
              showToast:
                'Invalid impact: must be one of Self, Home, Friends, Government',
            },
            400
          );
        }
        if (!canOverrideTagSource(item.impactsSource, tagSource)) {
          return c.json<UiResponse>(
            {
              showToast: 'Cannot override moderator-verified impact tags',
            },
            403
          );
        }
        validImpacts = validateImpacts(rawImpacts);
      }

      // Update tags if disciplines or impacts were provided
      if (disciplinesProvided || impactsProvided) {
        const tagUpdates: {
          disciplines?: Discipline[];
          disciplinesSource?: TagSource;
          impacts?: Impact[];
          impactsSource?: TagSource;
        } = {};

        if (disciplinesProvided) {
          tagUpdates.disciplines = validDisciplines;
          tagUpdates.disciplinesSource =
            validDisciplines.length > 0 ? tagSource : 'untagged';
        }

        if (impactsProvided) {
          tagUpdates.impacts = validImpacts;
          tagUpdates.impactsSource =
            validImpacts.length > 0 ? tagSource : 'untagged';
        }

        await updateGalleryItemTags(targetPostId, tagUpdates, redisClient);
      }

      // Handle location update if location input provided
      if (locationInput) {
        const resolved = resolvePlace(locationInput);
        if (resolved.status === 'unresolved') {
          return c.json<UiResponse>(
            {
              showToast:
                'Could not resolve place. Try "City, Country" (e.g. Tokyo, Japan)',
            },
            400
          );
        }

        if (resolved.status === 'ambiguous') {
          return c.json<UiResponse>(
            {
              showToast:
                'Ambiguous place. Please specify country or region (e.g. Cambridge, UK or Cambridge, US)',
            },
            400
          );
        }

        const placeStatus: PlaceStatus = isMod ? 'mod-verified' : 'poster-tagged';
        const place = toPlaceLocation(resolved.place, placeStatus);

        let takenAtEpoch: number | undefined;
        if (
          payload.takenDate &&
          /^\d{4}-\d{2}-\d{2}$/.test(payload.takenDate)
        ) {
          const parsedEpoch = Date.parse(payload.takenDate);
          if (!Number.isNaN(parsedEpoch)) {
            takenAtEpoch = Math.floor(parsedEpoch / 1000);
          }
        }

        await updateGalleryItemLocation(
          targetPostId,
          place,
          takenAtEpoch,
          redisClient
        );

        const displayPlace = resolved.place.city
          ? `${resolved.place.city}, ${resolved.place.countryName}`
          : resolved.place.countryName;

        if (disciplinesProvided || impactsProvided) {
          return c.json<UiResponse>(
            {
              showToast: `Tags and location updated: ${displayPlace}`,
            },
            200
          );
        }

        return c.json<UiResponse>(
          {
            showToast: `Location updated: ${displayPlace}`,
          },
          200
        );
      }

      return c.json<UiResponse>(
        {
          showToast: 'Tags updated successfully',
        },
        200
      );
    } catch (error) {
      console.error(`Error processing tag-location form: ${error}`);
      return c.json<UiResponse>(
        {
          showToast: 'Failed to update photo location',
        },
        500
      );
    }
  });

  return router;
};

export const forms = createFormsRouter();
