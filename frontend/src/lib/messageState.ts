export interface MessageIdentity {
  id: string;
  idempotencyKey?: string;
  status?: string;
  content?: string;
  isEdited?: boolean;
  editedAt?: number;
  deletedForEveryone?: boolean;
}

function isOptimisticTempId(id: string): boolean {
  return id.startsWith('msg-') || id.startsWith('temp-');
}

function isDeletedMessage(msg: MessageIdentity): boolean {
  return (
    Boolean(msg.deletedForEveryone) ||
    msg.content === 'This message was deleted' ||
    msg.content === 'This message was deleted.'
  );
}

function mergeMessageRecords<T extends MessageIdentity>(existing: T, incoming: T): T {
  const existingIsTemp = isOptimisticTempId(existing.id);
  const incomingIsTemp = isOptimisticTempId(incoming.id);
  const preferredId = existingIsTemp && !incomingIsTemp
    ? incoming.id
    : !existingIsTemp && incomingIsTemp
      ? existing.id
      : incoming.id;

  const preferredStatus =
    incoming.status && incoming.status !== 'sending'
      ? incoming.status
      : existing.status || incoming.status;

  const isExistingEdited = Boolean(existing.isEdited);
  const isIncomingEdited = Boolean(incoming.isEdited);

  let preferredContent = incoming.content ?? existing.content;
  let preferredEdited = isIncomingEdited || isExistingEdited;
  let preferredEditedAt = incoming.editedAt || existing.editedAt;

  if (isExistingEdited && !isIncomingEdited) {
    preferredContent = existing.content;
    preferredEdited = true;
    preferredEditedAt = existing.editedAt;
  } else if (isIncomingEdited && !isExistingEdited) {
    preferredContent = incoming.content;
    preferredEdited = true;
    preferredEditedAt = incoming.editedAt;
  } else if (isExistingEdited && isIncomingEdited) {
    if ((existing.editedAt || 0) > (incoming.editedAt || 0)) {
      preferredContent = existing.content;
      preferredEditedAt = existing.editedAt;
    } else {
      preferredContent = incoming.content;
      preferredEditedAt = incoming.editedAt;
    }
  }

  const preferredDeleted = Boolean(existing.deletedForEveryone || incoming.deletedForEveryone);

  return {
    ...existing,
    ...incoming,
    id: preferredId,
    content: preferredContent,
    isEdited: preferredEdited,
    editedAt: preferredEditedAt,
    deletedForEveryone: preferredDeleted,
    idempotencyKey: incoming.idempotencyKey || existing.idempotencyKey,
    status: preferredStatus,
  };
}

/**
 * Deduplicate messages by id and idempotencyKey while preserving first-seen chronological order
 * and filtering out deleted records completely.
 */
export function dedupeMessages<T extends MessageIdentity>(messages: T[]): T[] {
  const result: T[] = [];
  const indexById = new Map<string, number>();
  const indexByKey = new Map<string, number>();

  for (const msg of messages) {
    if (!msg?.id) continue;

    let existingIdx = indexById.get(msg.id);
    if (existingIdx === undefined && msg.idempotencyKey) {
      existingIdx = indexByKey.get(msg.idempotencyKey) ?? indexById.get(msg.idempotencyKey);
    }
    if (existingIdx === undefined) {
      existingIdx = indexByKey.get(msg.id);
    }

    if (isDeletedMessage(msg)) {
      if (existingIdx !== undefined) {
        result.splice(existingIdx, 1);
        indexById.clear();
        indexByKey.clear();
        result.forEach((m, idx) => {
          indexById.set(m.id, idx);
          if (m.idempotencyKey) indexByKey.set(m.idempotencyKey, idx);
        });
      }
      continue;
    }

    if (existingIdx !== undefined) {
      const merged = mergeMessageRecords(result[existingIdx], msg);
      if (isDeletedMessage(merged)) {
        // Drop previously retained item if incoming mark flagged it as deleted
        result.splice(existingIdx, 1);
        indexById.clear();
        indexByKey.clear();
        result.forEach((m, idx) => {
          indexById.set(m.id, idx);
          if (m.idempotencyKey) indexByKey.set(m.idempotencyKey, idx);
        });
        continue;
      }
      result[existingIdx] = merged;
      indexById.set(merged.id, existingIdx);
      if (merged.idempotencyKey) {
        indexByKey.set(merged.idempotencyKey, existingIdx);
      }
      continue;
    }

    const idx = result.length;
    result.push(msg);
    indexById.set(msg.id, idx);
    if (msg.idempotencyKey) {
      indexByKey.set(msg.idempotencyKey, idx);
    }
  }

  return result;
}

/**
 * Insert or update a message by server id, optimistic temporary id, or idempotencyKey without creating duplicates.
 */
export function upsertMessage<T extends MessageIdentity>(
  messages: T[],
  incoming: T,
  optimisticId?: string
): T[] {
  if (isDeletedMessage(incoming)) {
    return messages.filter(
      (m) =>
        m.id !== incoming.id &&
        (!optimisticId || (m.id !== optimisticId && m.idempotencyKey !== optimisticId)) &&
        (!incoming.idempotencyKey || m.idempotencyKey !== incoming.idempotencyKey)
    );
  }

  const matchesTarget = (m: T): boolean =>
    m.id === incoming.id ||
    Boolean(optimisticId && (m.id === optimisticId || m.idempotencyKey === optimisticId)) ||
    Boolean(
      incoming.idempotencyKey &&
        (m.id === incoming.idempotencyKey || m.idempotencyKey === incoming.idempotencyKey)
    );

  const hasMatch = messages.some(matchesTarget);
  if (!hasMatch) {
    return dedupeMessages([...messages, incoming]);
  }

  return dedupeMessages(
    messages.map((m) => (matchesTarget(m) ? mergeMessageRecords(m, incoming) : m))
  );
}

/**
 * Apply a WebSocket delivery acknowledgment and collapse any optimistic + server duplicates into one entry.
 */
export function reconcileMessageAck<T extends MessageIdentity>(
  messages: T[],
  ack: { messageId: string; clientGeneratedId?: string }
): T[] {
  return dedupeMessages(
    messages.map((m) =>
      (ack.clientGeneratedId &&
        (m.id === ack.clientGeneratedId || m.idempotencyKey === ack.clientGeneratedId)) ||
      m.id === ack.messageId
        ? ({ ...m, id: ack.messageId, status: 'delivered' } as T)
        : m
    )
  );
}
