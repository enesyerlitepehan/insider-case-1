type SQSEventRecord = {
  messageId: string;
  body: string;
  attributes?: Record<string, string>;
};

type SQSEvent = {
  Records: SQSEventRecord[];
};

export const lambdaHandler = async (event: SQSEvent) => {
  console.log("message-send-worker invoked");
  const table = process.env.MESSAGES_TABLE;
  const webhookUrl = process.env.WEBHOOK_URL;
  const maxLen = process.env.MAX_MESSAGE_LENGTH;

  console.log("env", { table, webhookUrl, maxLen });

  for (const rec of event.Records ?? []) {
    try {
      const payload = JSON.parse(rec.body);
      console.log("record", { messageId: rec.messageId, payload, attributes: rec.attributes });
    } catch (e) {
      console.log("record(raw)", { messageId: rec.messageId, body: rec.body, attributes: rec.attributes });
    }
  }

  // Successful no-op; SQS will remove messages after successful return
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, processed: event.Records?.length ?? 0 }),
  } as any;
};
