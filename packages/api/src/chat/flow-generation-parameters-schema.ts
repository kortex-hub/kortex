import z from 'zod';

export const kubernetesNameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

export const FlowGenerationParametersSchema = z.object({
  name: z
    .string()
    .regex(kubernetesNameRegex)
    .describe(
      `Name of the flow that will be saved. The name must match the kubernetes name regex /${kubernetesNameRegex.source}/.`,
    ),
  description: z.string().describe('Description of the flow, give a short description of what the flow does.'),
  prompt: z
    .string()
    .describe(
      'Help me create a reproducible prompt that achieves the same result as in the conversation above. The prompt will be executed by another LLM without any further user input, so it must include all the necessary information to reproduce the same outcome.',
    ),
});

export type FlowGenerationParameters = z.output<typeof FlowGenerationParametersSchema>;
