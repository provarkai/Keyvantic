import { Global, Module } from "@nestjs/common";
import { PrismaService, prismaProvider } from "./prisma.service";

@Global()
@Module({
  providers: [prismaProvider],
  exports: [PrismaService],
})
export class PrismaModule {}
