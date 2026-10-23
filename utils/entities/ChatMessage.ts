import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import type { ChatSession } from "./ChatSession.js";

@Entity("chat_messages")
export class ChatMessage {
  @PrimaryColumn({ type: "text" })
  session_id!: string;

  @PrimaryColumn({ type: "integer" })
  sequence!: number;

  @Column({ type: "text" })
  role!: string;

  @Column({ type: "text", nullable: true })
  content!: string | null;

  @Column({ type: "text", nullable: true })
  thinking!: string | null;

  @Column({ type: "text", nullable: true })
  tool_calls!: string | null;

  @Column({ type: "text", nullable: true })
  tool_name!: string | null;

  /** JSON array of base64-encoded image payloads (Ollama vision); null when absent. */
  @Column({ type: "text", nullable: true })
  images!: string | null;

  @ManyToOne("ChatSession", { onDelete: "CASCADE" })
  @JoinColumn({ name: "session_id" })
  session?: ChatSession | null;
}
