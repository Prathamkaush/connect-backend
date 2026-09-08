import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
@Injectable()
export class CuidPipe implements PipeTransform<string, string> {
  transform(value: string) {
    if (!/^c[a-z0-9]{20,30}$/i.test(value)) throw new BadRequestException({ code: 'INVALID_ID', message: 'Resource identifier is invalid.' });
    return value;
  }
}
