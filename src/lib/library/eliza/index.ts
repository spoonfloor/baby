import { seededRandom } from '#lib/baby/random.ts';
import { scriptPrimer } from '#lib/library/primer.ts';
import { Doctor } from './doctor.ts';
import { patientLines } from './patient.ts';

/**
 * Therapy Bot: 600 one-exchange conversations with a therapist, its replies generated
 * by ELIZA’s DOCTOR script.
 * The seed fixes the primer, so it’s the same text on every load and for every Baby.
 */
const EXCHANGES = 600;
const SEED = 1966;

function doctorScript(): string {
	const doctor = new Doctor();
	return patientLines(EXCHANGES, seededRandom(SEED))
		.map((line) => `you: ${line}\nbaby: ${doctor.respond(line)}`)
		.join('\n\n');
}

// The id stays `eliza`: it’s how a saved Baby remembers having read this.
export const eliza = scriptPrimer(
	'eliza',
	'Therapy Bot',
	doctorScript(),
	'Inspired by ELIZA (1966)'
);
