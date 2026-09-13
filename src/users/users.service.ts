import { Injectable, NotFoundException } from '@nestjs/common';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly users: UsersRepository) {}
  async getSafeProfile(id: string) {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found.' });
    return { id: user.id, name: user.name, email: user.email, phone: user.phone, city: user.city, postalCode: user.postalCode, role: user.role, isActive: user.isActive, emailVerified: user.emailVerified, freeQuotaUsed: user.freeQuotaUsed, createdAt: user.createdAt, updatedAt: user.updatedAt };
  }
  async updateProfile(id: string, dto: UpdateProfileDto) {
    await this.users.update(id, dto);
    return this.getSafeProfile(id);
  }
}
