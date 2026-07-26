import { IsOptional, IsString } from "class-validator";

export class SaveVersionDto {
  @IsString()
  contentMarkdown!: string;

  @IsString()
  contentHtml!: string;

  @IsOptional()
  @IsString()
  changeSummary?: string;
}
