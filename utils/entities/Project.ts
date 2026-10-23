import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("projects")
export class Project {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "text" })
  name!: string;

  @Column({ type: "text", nullable: true })
  workdir!: string | null;

  @Column({ type: "text", nullable: true })
  repository!: string | null;

  @Column({ type: "text", nullable: true })
  base_branch!: string | null;

  @Column({ type: "text", nullable: true })
  credentials!: string | null;

  @Column({ type: "text", nullable: true })
  ai_provider!: string | null;

  @Column({ type: "text", nullable: true })
  ai_path!: string | null;

  @Column({ type: "text", nullable: true })
  ai_model!: string | null;

  @Column({ type: "text", default: () => "datetime('now')" })
  created_at!: string;
}
