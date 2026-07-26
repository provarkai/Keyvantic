import { Module } from "@nestjs/common";
import { AiService } from "./ai.service";
import { AiController } from "./ai.controller";
import { AiClientModule } from "./ai-client.module";
import { SearchModule } from "../search/search.module";

@Module({
  imports: [AiClientModule, SearchModule],
  providers: [AiService],
  controllers: [AiController],
})
export class AiModule {}
