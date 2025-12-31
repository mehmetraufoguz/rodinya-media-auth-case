import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { ApiBearerAuth, ApiUnauthorizedResponse, ApiOkResponse } from '@nestjs/swagger';

@Controller('users')
export class UserController {
  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Authenticated user info' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @UseGuards(AuthGuard)
  getMe(@Req() req: Request) {
    // Authenticated user info
    return { message: 'User info endpoint', user: req["user"] ?? null };
  }
}
