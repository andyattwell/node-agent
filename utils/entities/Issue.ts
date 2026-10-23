import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import type { Project } from "./Project.js";
import { Comment } from "./Comment.js";

@Entity("issues")
export class Issue {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "text" })
  title!: string;

  @Column({ type: "text" })
  description!: string;

  @Column({ type: "text" })
  status!: string;

  @Column({ type: "text" })
  priority!: string;

  @Column({ type: "text" })
  type!: string;

  @Column({ type: "text", nullable: true })
  adw_id!: string | null;

  @Column({ type: "integer" })
  project_id!: number;

  /**
   * When true (default), ADW uses a separate git worktree under `trees/`.
   * When false, work is done on branch `adw-<id>` directly in the project repo checkout.
   */
  @Column({ type: "boolean", default: true })
  worktree!: boolean;

  @ManyToOne("Project")
  @JoinColumn({ name: "project_id" })
  project?: Project;

  @OneToMany(() => Comment, (c) => c.issue)
  comments?: Comment[];

  @Column({ type: "text", default: () => "datetime('now')" })
  created_at!: string;

  @Column({ type: "text", default: () => "datetime('now')" })
  updated_at!: string;
}
