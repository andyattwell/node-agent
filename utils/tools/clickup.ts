import fs from "node:fs";
import type { Tool } from "../../providers/utils/chat-types.js";
const CLICKUP_API_BASE = "https://api.clickup.com/api/v2";

/**
 * Fetch tasks (tickets) from a ClickUp list using the REST API.
 * Requires CLICKUP_PERSONAL_TOKEN in the environment (personal token from ClickUp Settings > Apps > API Token).
 * When CLICKUP_EMAIL is set, only tasks assigned to that user are returned (token must belong to that user).
 * @param listId - The list ID (number after /li in the list URL when you copy link from the list menu).
 * @param options - Optional: page (0-based), includeClosed, subtasks, orderBy (id|created|updated|due_date), reverse.
 * @returns JSON string with tasks or error message.
 */
export async function fetchClickUpTasks(
  listId: string,
  options?: {
    page?: number;
    includeClosed?: boolean;
    subtasks?: boolean;
    orderBy?: string;
    reverse?: boolean;
  },
): Promise<string> {
  const token = process.env.CLICKUP_PERSONAL_TOKEN?.trim();
  if (!token) {
    return '{"error": "CLICKUP_PERSONAL_TOKEN is not set. Add your ClickUp personal API token to the environment."}';
  }

  const listIdNum = Number(listId);
  if (!Number.isInteger(listIdNum) || listIdNum <= 0) {
    return '{"error": "listId must be a positive integer (the number from the list URL)."}';
  }

  const assigneeId = process.env.CLICKUP_USER_ID
    ? Number(process.env.CLICKUP_USER_ID)
    : null;

  try {
    const url = new URL(`${CLICKUP_API_BASE}/list/${listIdNum}/task`);
    if (options?.page !== undefined)
      url.searchParams.set("page", String(options.page));
    if (options?.includeClosed === true)
      url.searchParams.set("include_closed", "true");
    if (options?.subtasks === true) url.searchParams.set("subtasks", "true");
    if (options?.orderBy) url.searchParams.set("order_by", options.orderBy);
    if (options?.reverse === true) url.searchParams.set("reverse", "true");
    if (assigneeId !== null)
      url.searchParams.append("assignees[]", String(assigneeId));

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg =
        typeof data?.err === "string"
          ? data.err
          : (data?.message ?? `HTTP ${res.status}`);
      return JSON.stringify({ error: errMsg, status: res.status });
    }
    const tasks = data.tasks.map((task: any) => ({
      id: task.id,
      name: task.name,
      description: task.description,
      status: task.status,
      createdAt: task.created_at,
      dueDate: task.due_date,
      points: task.points,
      priority: task.priority,
    }));

    fs.writeFileSync("clickup_tasks.json", JSON.stringify(tasks, null, 2));
    return JSON.stringify(tasks, null, 2);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return JSON.stringify({ error: message });
  }
}

export const CLICKUP_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "fetchClickUpTasks",
      description:
        "Fetch tasks (tickets) from a ClickUp list. Requires CLICKUP_PERSONAL_TOKEN in the environment. List ID is the number after /li in the list URL (Copy link from list menu in ClickUp).",
      parameters: {
        type: "object",
        required: ["listId"],
        properties: {
          listId: {
            type: "string",
            description:
              "The ClickUp list ID (positive integer, from the list URL after /li).",
          },
          page: {
            type: "number",
            description:
              "Zero-based page index (API returns up to 100 tasks per page).",
          },
          includeClosed: {
            type: "boolean",
            description: "Include closed tasks; default is false.",
          },
          subtasks: {
            type: "boolean",
            description: "Include subtasks; default is false.",
          },
          orderBy: {
            type: "string",
            description:
              "Order by: id, created, updated, or due_date. Default is created.",
          },
          reverse: {
            type: "boolean",
            description: "Return tasks in reverse order.",
          },
        },
      },
    },
  },
];

export default {
  TOOLS: CLICKUP_TOOLS,
  toolFunctions: {
    fetchClickUpTasks,
  },
};
