import { Body, Controller, Get, NotFoundException, Param, Post } from "@nestjs/common";
import { ClientsService } from "./clients.service";
import { CreateClientDto } from "./dto/create-client.dto";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PrismaService } from "../../prisma/prisma.service";

@Controller("clients")
export class ClientsController {
  constructor(
    private clients: ClientsService,
    private prisma: PrismaService,
  ) {}

  @Get()
  list() {
    return this.clients.list();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.clients.findById(id);
  }

  @Post()
  @RequirePermissions("client:manage")
  async create(@Body() dto: CreateClientDto) {
    const clientsRoot = await this.prisma.category.findUnique({ where: { code: "CLIENTS" } });
    if (!clientsRoot) throw new NotFoundException("09 Clients root category is not seeded");
    return this.clients.create(dto, clientsRoot.id);
  }
}
