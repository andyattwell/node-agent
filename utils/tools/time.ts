import type { Tool } from "../../providers/utils/chat-types.js";

export function getDateAndTime(): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "America/Argentina/Buenos_Aires", // Specify IANA timezone name
    dateStyle: "full",
    timeStyle: "short",
  };

  const formatter = new Intl.DateTimeFormat("es-AR", options);

  return formatter.format(new Date());
}

export const TIME_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "getDateAndTime",
      description: "Return the current date and time",
      parameters: {
        type: "object",
        required: ["_"],
        properties: {
          _: {
            type: "string",
            description: "Ignored. Pass empty string.",
          },
        },
      },
    },
  },
];

export default {
  TOOLS: TIME_TOOLS,
  toolFunctions: {
    getDateAndTime,
  },
};
