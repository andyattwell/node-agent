import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import type { Issue } from "./Issue.js";

@Entity("comments")
export class Comment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "text" })
  commenter!: string;

  @Column({ type: "text" })
  comment!: string;

  @Column({ type: "integer" })
  issue_id!: number;

  @ManyToOne("Issue", { onDelete: "CASCADE" })
  @JoinColumn({ name: "issue_id" })
  issue?: Issue | null;

  @Column({ type: "text", default: () => "datetime('now')" })
  created_at!: string;
}
