import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from '../../common/types/auth-user.type';
import { UsersRepository } from '../../users/users.repository';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly users: UsersRepository) {
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), ignoreExpiration: false, secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET') });
  }
  async validate(payload: AuthUser & { sub: string }): Promise<AuthUser> {
    const user = await this.users.findById(payload.sub);
    if (!user?.isActive) throw new UnauthorizedException({ code: 'ACCOUNT_DISABLED', message: 'This account is unavailable.' });
    return { id: user.id, email: user.email, role: user.role };
  }
}
