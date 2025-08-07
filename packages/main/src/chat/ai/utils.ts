import { generateText, type UIMessage } from 'ai';
import { fromPromise, ok, type ResultAsync, safeTry } from 'neverthrow';

import { type AIError, AIInternalError } from '/@api/chat/errors/ai.js';

import { myProvider } from './models.js';

export function generateTitleFromUserMessage({ message }: { message: UIMessage }): ResultAsync<string, AIError> {
  return safeTry(async function* () {
    const result = yield* fromPromise(
      generateText({
        model: myProvider.languageModel('title-model'),
        system: `\n
          - you will generate a short title based on the first message a user begins a conversation with
          - ensure it is not more than 80 characters long
          - the title should be a summary of the user's message
          - do not use quotes or colons`,
        prompt: JSON.stringify(message),
      }),
      e => new AIInternalError({ cause: e }),
    );

    return ok(result.text);
  });
}
