import * as yup from 'yup';

const envLimit = Number(process.env.MAX_MESSAGE_LENGTH || 200);
const maxMessageLength = Number.isFinite(envLimit) && envLimit > 0 ? envLimit : 200;

export const postMessageSchema = yup.object({
  body: yup
    .object({
      to: yup.string().required('to is required'),
      content: yup
        .string()
        .required('content is required')
        .max(maxMessageLength, `content must be at most ${maxMessageLength} characters`),
    })
    .required(),
});
