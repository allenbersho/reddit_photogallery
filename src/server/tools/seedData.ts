import type { GalleryItem, Topic } from '../../shared/types.js';
import { saveGalleryItem, type RedisClientContract } from '../data/galleryStore.js';

export type SeedPostConfig = {
  id: string;
  title: string;
  author: string;
  topic: Topic;
  subreddit: string;
  createdAt: number;
  takenAt?: number | undefined;
  imageUrl: string;
  previewUrl: string;
  width: number;
  height: number;
  place?: {
    raw: string;
    country: string;
    region: string;
    city: string;
  } | undefined;
};

export const SAMPLE_POSTS: readonly SeedPostConfig[] = [
  // Science Posts
  {
    id: 't3_seed_sci_01',
    title: 'James Webb Space Telescope captures high-resolution infrared view of the Carina Nebula',
    author: 'astro_physicist',
    topic: 'science',
    subreddit: 'science',
    createdAt: 1715000000,
    imageUrl: 'https://i.redd.it/carina_jwst.jpg',
    previewUrl: 'https://preview.redd.it/carina_jwst.jpg',
    width: 2048,
    height: 1536,
    place: { raw: 'Geneva, Switzerland', country: 'CH', region: 'GE', city: 'Geneva' },
  },
  {
    id: 't3_seed_sci_02',
    title: 'Superconducting quantum qubit array operating inside dilution refrigerator at 15 millikelvin',
    author: 'quantum_lab',
    topic: 'science',
    subreddit: 'science',
    createdAt: 1718000000,
    imageUrl: 'https://i.redd.it/quantum_cryo.jpg',
    previewUrl: 'https://preview.redd.it/quantum_cryo.jpg',
    width: 1920,
    height: 1280,
    place: { raw: 'San Francisco, CA, USA', country: 'US', region: 'CA', city: 'San Francisco' },
  },
  {
    id: 't3_seed_sci_03',
    title: 'CERN ATLAS detector during scheduled beam maintenance shutdown',
    author: 'cern_insider',
    topic: 'science',
    subreddit: 'science',
    createdAt: 1722000000,
    imageUrl: 'https://i.redd.it/atlas_cern.jpg',
    previewUrl: 'https://preview.redd.it/atlas_cern.jpg',
    width: 2560,
    height: 1440,
    place: { raw: 'Geneva, Switzerland', country: 'CH', region: 'GE', city: 'Geneva' },
  },
  {
    id: 't3_seed_sci_04',
    title: 'Deep sea hydrothermal vent chimney with glowing bioluminescent organisms',
    author: 'marine_bio',
    topic: 'science',
    subreddit: 'science',
    createdAt: 1726000000,
    imageUrl: 'https://i.redd.it/deep_ocean_vent.jpg',
    previewUrl: 'https://preview.redd.it/deep_ocean_vent.jpg',
    width: 1920,
    height: 1080,
    place: { raw: 'Tokyo, Japan', country: 'JP', region: '13', city: 'Tokyo' },
  },
  {
    id: 't3_seed_sci_05',
    title: 'Crystal lattice structure of synthesized high-temperature superconductor under electron microscope',
    author: 'materials_nerd',
    topic: 'science',
    subreddit: 'science',
    createdAt: 1729000000,
    imageUrl: 'https://i.redd.it/sem_crystal.jpg',
    previewUrl: 'https://preview.redd.it/sem_crystal.jpg',
    width: 1600,
    height: 1200,
    place: undefined, // Unplaced
  },

  // Engineering Posts
  {
    id: 't3_seed_eng_01',
    title: 'Full stack assembly of humanoid robotics actuation joint with harmonic drive gearbox',
    author: 'mechatronics_pro',
    topic: 'engineering',
    subreddit: 'engineering',
    createdAt: 1716000000,
    imageUrl: 'https://i.redd.it/robot_joint.jpg',
    previewUrl: 'https://preview.redd.it/robot_joint.jpg',
    width: 1920,
    height: 1080,
    place: { raw: 'Tokyo, Japan', country: 'JP', region: '13', city: 'Tokyo' },
  },
  {
    id: 't3_seed_eng_02',
    title: 'Structural steel cantilever beam installation over suspension bridge expansion joint',
    author: 'civil_builder',
    topic: 'engineering',
    subreddit: 'engineering',
    createdAt: 1720000000,
    imageUrl: 'https://i.redd.it/bridge_truss.jpg',
    previewUrl: 'https://preview.redd.it/bridge_truss.jpg',
    width: 2048,
    height: 1365,
    place: { raw: 'San Francisco, CA, USA', country: 'US', region: 'CA', city: 'San Francisco' },
  },
  {
    id: 't3_seed_eng_03',
    title: 'High-density multilayer printed circuit board with ball-grid array routing under optical inspection',
    author: 'hardware_hacker',
    topic: 'engineering',
    subreddit: 'engineering',
    createdAt: 1724000000,
    imageUrl: 'https://i.redd.it/pcb_routing.jpg',
    previewUrl: 'https://preview.redd.it/pcb_routing.jpg',
    width: 1920,
    height: 1080,
    place: { raw: 'London, UK', country: 'GB', region: 'ENG', city: 'London' },
  },
  {
    id: 't3_seed_eng_04',
    title: 'Cryogenic methane rocket engine test firing with visible Mach diamonds in exhaust plume',
    author: 'propulsion_lead',
    topic: 'engineering',
    subreddit: 'engineering',
    createdAt: 1728000000,
    imageUrl: 'https://i.redd.it/rocket_diamonds.jpg',
    previewUrl: 'https://preview.redd.it/rocket_diamonds.jpg',
    width: 2400,
    height: 1600,
    place: { raw: 'Los Angeles, CA, USA', country: 'US', region: 'CA', city: 'Los Angeles' },
  },
  {
    id: 't3_seed_eng_05',
    title: 'Tunnel boring machine cutter head inspection after completing 5km transit',
    author: 'tunnel_engineer',
    topic: 'engineering',
    subreddit: 'engineering',
    createdAt: 1731000000,
    imageUrl: 'https://i.redd.it/tbm_cutter.jpg',
    previewUrl: 'https://preview.redd.it/tbm_cutter.jpg',
    width: 1920,
    height: 1200,
    place: { raw: 'Paris, France', country: 'FR', region: 'IDF', city: 'Paris' },
  },

  // Art Posts
  {
    id: 't3_seed_art_01',
    title: 'Sculpted bronze kinetic mobius strip with polished mirror reflections in public plaza',
    author: 'sculptor_sam',
    topic: 'art',
    subreddit: 'art',
    createdAt: 1717000000,
    imageUrl: 'https://i.redd.it/kinetic_bronze.jpg',
    previewUrl: 'https://preview.redd.it/kinetic_bronze.jpg',
    width: 1800,
    height: 1200,
    place: { raw: 'Paris, France', country: 'FR', region: 'IDF', city: 'Paris' },
  },
  {
    id: 't3_seed_art_02',
    title: 'Macro oil painting impasto texture exploring turbulent fluid dynamics',
    author: 'canvas_painter',
    topic: 'art',
    subreddit: 'art',
    createdAt: 1721000000,
    imageUrl: 'https://i.redd.it/oil_impasto.jpg',
    previewUrl: 'https://preview.redd.it/oil_impasto.jpg',
    width: 2000,
    height: 2000,
    place: { raw: 'London, UK', country: 'GB', region: 'ENG', city: 'London' },
  },
  {
    id: 't3_seed_art_03',
    title: 'Minimalist brutalist concrete geometry under sunset shadow gradients',
    author: 'architecture_eye',
    topic: 'art',
    subreddit: 'art',
    createdAt: 1725000000,
    imageUrl: 'https://i.redd.it/brutalist_concrete.jpg',
    previewUrl: 'https://preview.redd.it/brutalist_concrete.jpg',
    width: 1920,
    height: 1080,
    place: { raw: 'New York, NY, USA', country: 'US', region: 'NY', city: 'New York' },
  },
  {
    id: 't3_seed_art_04',
    title: 'Ceramic wood-fired teaware displaying natural ash deposit crystallization',
    author: 'pottery_master',
    topic: 'art',
    subreddit: 'art',
    createdAt: 1727000000,
    imageUrl: 'https://i.redd.it/anagama_tea.jpg',
    previewUrl: 'https://preview.redd.it/anagama_tea.jpg',
    width: 1920,
    height: 1440,
    place: { raw: 'Kyoto, Japan', country: 'JP', region: '26', city: 'Kyoto' },
  },
  {
    id: 't3_seed_art_05',
    title: 'Generative geometric mosaic rendering fractal attractor orbits',
    author: 'creative_coder',
    topic: 'art',
    subreddit: 'art',
    createdAt: 1730000000,
    imageUrl: 'https://i.redd.it/fractal_mosaic.jpg',
    previewUrl: 'https://preview.redd.it/fractal_mosaic.jpg',
    width: 1920,
    height: 1080,
    place: undefined, // Unplaced
  },
];

export const seedGalleryStore = async (
  redis: RedisClientContract,
  posts: readonly SeedPostConfig[] = SAMPLE_POSTS
): Promise<number> => {
  let seededCount = 0;
  for (const config of posts) {
    const item: GalleryItem = {
      id: config.id,
      permalink: `/r/${config.subreddit}/comments/${config.id}`,
      title: config.title,
      author: config.author,
      subreddit: config.subreddit,
      createdAt: config.createdAt,
      takenAt: config.takenAt,
      media: {
        url: config.imageUrl,
        previewUrl: config.previewUrl,
        width: config.width,
        height: config.height,
      },
      disciplines: [],
      disciplinesSource: 'untagged',
      impacts: [],
      impactsSource: 'untagged',
      isCrosspost: false,
      topic: config.topic,
      topicSource: 'flair',
      place: config.place
        ? {
            raw: config.place.raw,
            country: config.place.country,
            region: config.place.region,
            city: config.place.city,
            status: 'poster-tagged',
          }
        : undefined,
      isModHidden: false,
      isNsfw: false,
      isRemoved: false,
      capturedAt: config.createdAt * 1000,
      lastVerifiedAt: config.createdAt * 1000,
    };

    await saveGalleryItem(item, redis);
    seededCount += 1;
  }
  return seededCount;
};
