import { Injectable } from '@nestjs/common';
import { MenuSaveDto } from '../dto/menu.save-dto';
import { MenuUpdateDto } from '../dto/menu.update-dto';

@Injectable()
export class MenusValidator {
  validateSaveDto(saveDto: MenuSaveDto): void {
    if (!saveDto) {
      throw Error();
    }

    const name: string = saveDto.name.trim();
    if (!name || name.length < 2 || name.length > 50) {
      throw Error();
    }

    const restaurantId: number = saveDto.restaurantId;
    if (!restaurantId || restaurantId < 1) {
      throw Error();
    }
  }

  validateUpdateDto(updateDto: MenuUpdateDto): void {
    if (!updateDto) {
      throw Error();
    }

    const name: string = updateDto.newName.trim();
    if (!name || name.length < 2 || name.length > 50) {
      throw Error();
    }
  }
}
