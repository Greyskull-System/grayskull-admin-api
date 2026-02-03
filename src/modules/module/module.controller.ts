import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ModuleService } from './module.service';

@Controller('modules')
export class ModuleController {
  constructor(private readonly moduleService: ModuleService) {}

  @Post()
  create(@Body() body: {
    code: string;
    name: string;
    description?: string;
    version?: string;
    isCore?: boolean;
    isCustom?: boolean;
    repositoryUrl?: string;  // Link do GitHub (referência)
    modulePath?: string;     // Nome da pasta do projeto (ex: grayskull-baileys-service) - OBRIGATÓRIO se isCustom
    migrationsPath?: string; // Subpasta das migrations dentro do projeto (padrão: prisma)
  }) {
    return this.moduleService.create(body);
  }

  @Get()
  findAll(@Query('isCustom') isCustom?: string) {
    const filters = isCustom !== undefined ? { isCustom: isCustom === 'true' } : undefined;
    return this.moduleService.findAll(filters);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.moduleService.findById(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      description?: string;
      version?: string;
      isActive?: boolean;
      isCustom?: boolean;
      repositoryUrl?: string;  // Link do GitHub (referência)
      modulePath?: string;     // Nome da pasta do projeto (OBRIGATÓRIO se isCustom)
      migrationsPath?: string; // Subpasta das migrations dentro do projeto (padrão: prisma)
    },
  ) {
    return this.moduleService.update(id, body);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.moduleService.delete(id);
  }

  @Post('seed')
  seed() {
    return this.moduleService.seed();
  }
}
