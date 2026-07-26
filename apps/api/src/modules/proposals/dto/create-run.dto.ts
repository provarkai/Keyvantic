import { IsString } from "class-validator";

export class CreateProposalRunDto {
  @IsString()
  templateDocId!: string;

  @IsString()
  clientId!: string;
}
