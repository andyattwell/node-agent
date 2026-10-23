import { Entity, PrimaryColumn, Column } from "typeorm";

@Entity("chat_sessions")
export class ChatSession {
  @PrimaryColumn({ type: "text" })
  id!: string;

  @Column({ type: "text", nullable: true })
  title!: string | null;

  @Column({ type: "text", default: () => "datetime('now')" })
  created_at!: string;

  @Column({ type: "text", default: () => "datetime('now')" })
  updated_at!: string;
}
