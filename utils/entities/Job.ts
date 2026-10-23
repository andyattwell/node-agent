import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import type { Project } from "./Project.js";

@Entity("jobs")
export class Job {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "text", nullable: true })
  adw_id!: string | null;

  @Column({ type: "text", nullable: true })
  step!: string | null;

  @Column({ type: "text" })
  status!: string;

  @Column({ type: "text" })
  prompt!: string;

  @Column({ type: "text", default: () => "datetime('now')" })
  created_at!: string;

  @Column({ type: "text", nullable: true })
  started_at!: string | null;

  @Column({ type: "text", default: () => "datetime('now')" })
  updated_at!: string;

  @Column({ type: "integer", nullable: true })
  process_id!: number | null;

  @Column({ type: "integer", nullable: true })
  project_id!: number | null;

  @Column({ type: "integer", nullable: true })
  issue_id!: number | null;

  /** JSON copy of workflow state.json while this job row was active (updated on each saveState). */
  @Column({ type: "text", nullable: true })
  state_snapshot!: string | null;

  @ManyToOne("Project", { nullable: true })
  @JoinColumn({ name: "project_id" })
  project?: Project | null;
}
