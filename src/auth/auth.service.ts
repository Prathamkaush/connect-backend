import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersRepository } from '../users/users.repository';
import { compare, hash } from 'bcrypt';
import { hashToken, newRequestId } from '../common/utils/token.util';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

type RefreshClaims = { sub: string; email: string; role: string; jti: string; type: 'refresh' };

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly users: UsersRepository, private readonly jwt: JwtService, private readonly config: ConfigService) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    if (await this.users.findByEmail(email)) throw new ConflictException({ code: 'EMAIL_EXISTS', message: 'An account with this email already exists.' });
    const user = await this.users.create({ name: dto.name.trim(), email, phone: dto.phone, city: dto.city, postalCode: dto.postalCode, passwordHash: await hash(dto.password, 12) });
    return this.issueTokens(user.id, user.email, user.role);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email.trim().toLowerCase());
    if (!user || !user.isActive || !(await compare(dto.password, user.passwordHash))) throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' });
    return this.issueTokens(user.id, user.email, user.role);
  }

  async refresh(rawToken: string) {
    let claims: RefreshClaims;
    try { claims = await this.jwt.verifyAsync<RefreshClaims>(rawToken, { secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET') }); }
    catch { throw new UnauthorizedException({ code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token is invalid or expired.' }); }
    if (claims.type !== 'refresh') throw new UnauthorizedException({ code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token is invalid.' });
    const session = await this.prisma.refreshSession.findUnique({ where: { tokenHash: hashToken(rawToken) }, include: { user: true } });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.isActive) throw new UnauthorizedException({ code: 'REFRESH_REVOKED', message: 'Refresh session is no longer valid.' });
    await this.prisma.refreshSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return this.issueTokens(session.user.id, session.user.email, session.user.role);
  }

  async logout(rawToken: string) {
    await this.prisma.refreshSession.updateMany({ where: { tokenHash: hashToken(rawToken), revokedAt: null }, data: { revokedAt: new Date() } });
    return { loggedOut: true };
  }

  private async issueTokens(userId: string, email: string, role: string) {
    const jti = newRequestId();
    const accessToken = await this.jwt.signAsync({ sub: userId, email, role }, { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'), expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '15m') as never });
    const days = this.config.get<number>('JWT_REFRESH_TTL_DAYS', 30);
    const refreshToken = await this.jwt.signAsync({ sub: userId, email, role, jti, type: 'refresh' }, { secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'), expiresIn: `${days}d` });
    await this.prisma.refreshSession.create({ data: { userId, tokenHash: hashToken(refreshToken), expiresAt: new Date(Date.now() + days * 86_400_000) } });
    return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '15m') };
  }
}
