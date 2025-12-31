import { Controller, Post, Body, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiBadRequestResponse, ApiUnauthorizedResponse, ApiOkResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

@Controller('auth')
@UsePipes(new ValidationPipe({ whitelist: true }))
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOkResponse({ description: 'User registered' })
  @ApiBadRequestResponse({ description: 'Email already registered or validation error' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOkResponse({ description: 'Login successful, returns tokens' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @ApiOkResponse({ description: 'Access token refreshed' })
  @ApiUnauthorizedResponse({ description: 'Invalid refresh token' })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto);
  }
}
