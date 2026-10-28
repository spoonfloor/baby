import type { BabyState, Document, ReplyTrace } from '#lib/baby/index.ts';
import { count } from '#lib/baby/reading.ts';
import { EOS, tokenize } from '#lib/baby/vocabulary.ts';
import type { Pack } from '#lib/library/index.ts';
import type { Message } from './chat.svelte.ts';
import type { Notice } from './notices.ts';

/**
 * The whole conversation as plain text, for debugging Baby: what was said, and for
 * each reply, what Baby actually saw, which words it didn’t know, why it stopped,
 * and whether it recited something it read.
 */

export interface TranscriptOptions {
	/** What Baby knows now. */
	knowledge: BabyState | undefined;
	/** Every pack there is; the ones Baby has read are looked up in it. */
	packs: readonly Pack[];
	/** The app’s words for a notice. */
	noticeText: (notice: Notice) => string;
	at: Date;
}

const RULE = '─'.repeat(30);

export function transcript(
	messages: readonly Message[],
	{ knowledge, packs, noticeText, at }: TranscriptOptions
): string {
	const read = (knowledge?.sources ?? []).flatMap(
		(source) => packs.find((pack) => pack.id === source) ?? []
	);
	const lines = [
		`Baby transcript · ${at.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`,
		`Knows ${count(knowledge?.words.length ?? 0, 'word')} · read ${read.map((pack) => pack.title).join(', ') || 'nothing'}`
	];

	for (const message of messages) {
		switch (message.role) {
			case 'user':
				lines.push('', RULE, `you: ${message.text}`);
				break;
			case 'app':
				lines.push(`app: ${noticeText(message.notice)}`);
				break;
			case 'baby':
				if (message.request === 'read') {
					lines.push('', RULE, `reading: ${message.status}`);
					break;
				}
				lines.push(`baby: ${message.text || '(nothing)'}`, `  status:   ${message.status}`);
				if (message.trace) lines.push(...traceLines(message.trace));
				if (message.text) {
					const match = recited(tokenize(message.text), read);
					if (match) {
						lines.push(`  verbatim: matches “${match.pack}” (reply to “${match.prompt}”)`);
					}
				}
				break;
		}
	}
	return lines.join('\n') + '\n';
}

function traceLines({ prompt, unknown, context, stop }: ReplyTrace): string[] {
	const known = prompt.filter((word) => !unknown.includes(word)).length;
	return [
		`  saw:      ${context.join(' ')}`,
		`  known:    ${known} of ${prompt.length}` +
			(unknown.length > 0 ? ` · unknown: ${unknown.join(', ')}` : ''),
		`  stopped:  ${stop === 'eos' ? 'picked [EOS]' : 'reached the longest reply'}`
	];
}

/**
 * The first read pack with a Baby turn saying exactly `reply`, and the turn it
 * answered there.
 */
function recited(
	reply: readonly string[],
	packs: readonly Pack[]
): { pack: string; prompt: string } | undefined {
	const turn = ['baby', ':', ...reply, EOS];
	for (const pack of packs) {
		for (const document of pack.documents) {
			const start = turnStarts(document).find((index) =>
				turn.every((token, offset) => document[index + offset] === token)
			);
			if (start === undefined) continue;
			const previous = turnStarts(document).findLast((index) => index < start);
			const prompt =
				previous === undefined ? '' : document.slice(previous + 2, start - 1).join(' ');
			return { pack: pack.title, prompt };
		}
	}
	return undefined;
}

/** Where each turn begins: the start, and just after every [EOS]. */
function turnStarts(document: Document): number[] {
	return [0, ...document.flatMap((token, index) => (token === EOS ? [index + 1] : []))].filter(
		(index) => index < document.length
	);
}
