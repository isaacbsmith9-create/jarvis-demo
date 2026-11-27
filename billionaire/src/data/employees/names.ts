import type { TraitId } from '../../types/core';

export const FIRST_NAMES = [
  'Alejandro', 'Sofia', 'Marcus', 'Valentina', 'Daniel', 'Camila', 'Andre', 'Isabella', 'Javier', 'Natalia',
  'Kevin', 'Gabriela', 'Darnell', 'Lucia', 'Ethan', 'Mariana', 'Omar', 'Priya', 'Luis', 'Chloe',
  'Mateo', 'Aaliyah', 'Ryan', 'Elena', 'Jamal', 'Daniela', 'Tyler', 'Ana', 'Victor', 'Jasmine',
  'Carlos', 'Renee', 'Diego', 'Monique', 'Nathan', 'Yesenia', 'Samuel', 'Tatiana', 'Brandon', 'Ines',
  'Rafael', 'Keisha', 'Adrian', 'Paola', 'Julian', 'Simone', 'Hector', 'Amara', 'Cole', 'Bianca',
  'Felipe', 'Naomi', 'Xavier', 'Leah', 'Ricardo', 'Imani', 'Owen', 'Carolina', 'Malik', 'Grace',
];

export const LAST_NAMES = [
  'Alvarez', 'Thompson', 'Reyes', 'Castillo', 'Washington', 'Morales', 'Bennett', 'Herrera', 'Brooks', 'Delgado',
  'Patel', 'Navarro', 'Coleman', 'Fuentes', 'Hayes', 'Vargas', 'Sullivan', 'Medina', 'Price', 'Ortega',
  'Kim', 'Salazar', 'Jenkins', 'Romero', 'Carter', 'Mendoza', 'Hughes', 'Ibarra', 'Foster', 'Cabrera',
  'Nguyen', 'Rivas', 'Powell', 'Santana', 'Russell', 'Aguilar', 'Bryant', 'Montoya', 'Graham', 'Paredes',
  'Okafor', 'Duarte', 'Fischer', 'Quintero', 'Marsh', 'Soto', 'Levine', 'Arroyo', 'Whitfield', 'Lozano',
];

export const TRAITS: Record<TraitId, { label: string; description: string; perf: number; loyalty: number; positive: boolean }> = {
  diligent: { label: 'Diligent', description: 'Consistently high output.', perf: 8, loyalty: 0, positive: true },
  charismatic: { label: 'Charismatic', description: 'Customers and clients respond well.', perf: 5, loyalty: 0, positive: true },
  ambitious: { label: 'Ambitious', description: 'Improves quickly; expects raises.', perf: 4, loyalty: -6, positive: true },
  loyal: { label: 'Loyal', description: 'Rarely looks for other work.', perf: 0, loyalty: 15, positive: true },
  volatile: { label: 'Volatile', description: 'Performance swings day to day.', perf: -3, loyalty: -4, positive: false },
  creative: { label: 'Creative', description: 'Raises product and service quality.', perf: 5, loyalty: 0, positive: true },
  meticulous: { label: 'Meticulous', description: 'Fewer mistakes, less waste.', perf: 4, loyalty: 2, positive: true },
  lazy: { label: 'Unmotivated', description: 'Does the minimum.', perf: -10, loyalty: 0, positive: false },
  mentor: { label: 'Mentor', description: 'Coworkers improve faster.', perf: 2, loyalty: 4, positive: true },
};

export const TRAIT_IDS = Object.keys(TRAITS) as TraitId[];
