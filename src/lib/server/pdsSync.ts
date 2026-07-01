import { getRecordByAtUri, listRecordsByRepo, parseAtUri } from '$lib/server/atproto.js';
import type { Message } from '$lib/server/db.js';
import {
	createMessageFromPds,
	getMessageById,
	getMessageByQuestionRecordUri,
	markAnswerMissingFromPds,
	markQuestionMissingFromPds,
	reconcileAnswerFromPds,
	reconcileQuestionFromPds,
	updateMessageAnswerRef,
	updateMessageQuestionRef
} from '$lib/server/db.js';

type Env = App.Platform['env'];

function logSkippedRecord(reason: string, uri: string, details?: Record<string, unknown>): void {
	console.warn('[pds-sync] skipped record', {
		reason,
		uri,
		...details
	});
}

function asString(value: unknown): string | null {
	return typeof value === 'string' ? value : null;
}

function asDid(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	return value.startsWith('did:') ? value : null;
}

function parseMessageIdFromUrl(url: string | null, appUrl: string): string | null {
	if (!url) return null;
	let parsedUrl: URL;
	try {
		parsedUrl = new URL(url);
	} catch {
		return null;
	}

	const base = new URL(appUrl);
	if (parsedUrl.origin !== base.origin) return null;

	const matched = parsedUrl.pathname.match(/^\/u\/[^/]+\/m\/([0-9a-fA-F-]{36})$/);
	if (!matched) return null;
	return matched[1] ?? null;
}

async function ingestQuestionCreatesFromPds(env: Env, senderDid: string, appUrl: string): Promise<boolean> {
	const records = await listRecordsByRepo(senderDid, 'com.suibari.meyasuat.question', 50);
	let changed = false;

	for (const rec of records) {
		const text = asString(rec.value.text);
		const subjectDid = asDid(rec.value.subject);
		const messageId = parseMessageIdFromUrl(asString(rec.value.url), appUrl);
		if (!text || !subjectDid || !messageId) {
			logSkippedRecord('question-missing-required-fields-or-message-id', rec.uri, {
				hasText: !!text,
				hasSubjectDid: !!subjectDid,
				hasMessageId: !!messageId
			});
			continue;
		}

		let message = await getMessageById(env, messageId);
		if (!message) {
			message = await createMessageFromPds(env, {
				id: messageId,
				creatorDid: subjectDid,
				body: text,
				senderDid,
				questionRecordUri: rec.uri,
				questionRecordCid: rec.cid
			});
			if (message) changed = true;
			else {
				logSkippedRecord('question-create-from-pds-failed', rec.uri, { messageId });
				continue;
			}
		}

		if (!message || message.senderDid !== senderDid) {
			logSkippedRecord('question-owner-mismatch', rec.uri, {
				messageId,
				expectedSenderDid: senderDid,
				actualSenderDid: message?.senderDid ?? null
			});
			continue;
		}

		const parsed = parseAtUri(rec.uri);
		if (!parsed || parsed.repo !== senderDid) {
			logSkippedRecord('question-at-uri-repo-mismatch', rec.uri, {
				expectedRepoDid: senderDid,
				actualRepoDid: parsed?.repo ?? null
			});
			continue;
		}

		if (message.questionRecordUri !== rec.uri || message.questionRecordCid !== rec.cid) {
			const updated = await updateMessageQuestionRef(env, message.id, senderDid, rec.uri, rec.cid);
			if (updated) changed = true;
		}

		if (text !== message.body || !!message.senderDeletedAt) {
			await reconcileQuestionFromPds(env, message.id, { body: text, cid: rec.cid });
			changed = true;
		}
	}

	return changed;
}

async function ingestAnswerCreatesFromPds(env: Env, creatorDid: string, appUrl: string): Promise<boolean> {
	const records = await listRecordsByRepo(creatorDid, 'com.suibari.meyasuat.answer', 50);
	let changed = false;

	for (const rec of records) {
		const answerText = asString(rec.value.answer);
		const questionText = asString(rec.value.question);
		const createdAt = asString(rec.value.createdAt);
		const subjectDid = asDid(rec.value.subject);
		const questionRef = rec.value.questionRef as { uri?: unknown } | undefined;
		const questionRefUri = asString(questionRef?.uri);
		const messageIdFromUrl = parseMessageIdFromUrl(asString(rec.value.url), appUrl);

		if (!answerText || !questionText) {
			logSkippedRecord('answer-missing-required-fields', rec.uri, {
				hasAnswer: !!answerText,
				hasQuestion: !!questionText
			});
			continue;
		}

		let message: Message | null = null;
		if (questionRefUri) {
			message = await getMessageByQuestionRecordUri(env, questionRefUri);
		}
		if (!message && messageIdFromUrl) {
			message = await getMessageById(env, messageIdFromUrl);
		}

		if (!message && messageIdFromUrl) {
			message = await createMessageFromPds(env, {
				id: messageIdFromUrl,
				creatorDid,
				body: questionText,
				senderDid: subjectDid,
				questionRecordUri: questionRefUri,
				answer: answerText,
				answeredAt: createdAt,
				answerRecordUri: rec.uri,
				answerRecordCid: rec.cid
			});
			if (message) changed = true;
			else {
				logSkippedRecord('answer-create-from-pds-failed', rec.uri, { messageId: messageIdFromUrl });
				continue;
			}
		}

		if (!message || message.creatorDid !== creatorDid) {
			logSkippedRecord('answer-unidentifiable-or-owner-mismatch', rec.uri, {
				messageIdFromUrl,
				questionRefUri,
				expectedCreatorDid: creatorDid,
				actualCreatorDid: message?.creatorDid ?? null
			});
			continue;
		}

		if (message.answerRecordUri !== rec.uri || message.answerRecordCid !== rec.cid) {
			const updated = await updateMessageAnswerRef(env, message.id, creatorDid, rec.uri, rec.cid);
			if (updated) changed = true;
		}

		if (
			answerText !== message.answer ||
			(createdAt && createdAt !== message.answeredAt) ||
			!!message.answerDeletedAt
		) {
			await reconcileAnswerFromPds(env, message.id, {
				answer: answerText,
				answeredAt: createdAt ?? message.answeredAt,
				cid: rec.cid
			});
			changed = true;
		}
	}

	return changed;
}

export async function ingestCreatesFromPdsForUser(env: Env, userDid: string, appUrl: string): Promise<boolean> {
	const [questionResult, answerResult] = await Promise.allSettled([
		ingestQuestionCreatesFromPds(env, userDid, appUrl),
		ingestAnswerCreatesFromPds(env, userDid, appUrl)
	]);

	const questionChanged = questionResult.status === 'fulfilled' && questionResult.value;
	const answerChanged = answerResult.status === 'fulfilled' && answerResult.value;
	return questionChanged || answerChanged;
}

export async function reconcileMessageWithPds(env: Env, message: Message): Promise<boolean> {
	let changed = false;

	if (message.questionRecordUri) {
		const question = await getRecordByAtUri(message.questionRecordUri);
		if (question.notFound) {
			await markQuestionMissingFromPds(env, message.id);
			changed = true;
		} else if (question.found && question.value) {
			const text = asString(question.value.text);
			if (text && (text !== message.body || (question.cid && question.cid !== message.questionRecordCid) || !!message.senderDeletedAt)) {
				await reconcileQuestionFromPds(env, message.id, {
					body: text,
					cid: question.cid ?? null
				});
				changed = true;
			}
		}
	}

	if (message.answerRecordUri) {
		const answer = await getRecordByAtUri(message.answerRecordUri);
		if (answer.notFound) {
			await markAnswerMissingFromPds(env, message.id);
			changed = true;
		} else if (answer.found && answer.value) {
			const answerText = asString(answer.value.answer);
			const createdAt = asString(answer.value.createdAt);
			if (
				answerText && (
					answerText !== message.answer ||
					(answer.cid && answer.cid !== message.answerRecordCid) ||
					(createdAt && createdAt !== message.answeredAt) ||
					!!message.answerDeletedAt
				)
			) {
				await reconcileAnswerFromPds(env, message.id, {
					answer: answerText,
					answeredAt: createdAt ?? message.answeredAt,
					cid: answer.cid ?? null
				});
				changed = true;
			}
		}
	}

	return changed;
}

export async function reconcileMessagesWithPds(env: Env, messages: Message[]): Promise<boolean> {
	const results = await Promise.allSettled(messages.map((m) => reconcileMessageWithPds(env, m)));
	return results.some((r) => r.status === 'fulfilled' && r.value);
}
