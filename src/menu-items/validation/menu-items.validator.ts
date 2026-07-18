import { Injectable } from '@nestjs/common';

import { MenuItemSaveDto } from '../dto/menu-item.save-dto';
import { MenuItemUpdateDto } from '../dto/menu-item.update-dto';

@Injectable()
export class MenuItemsValidator {
  validateSaveDto(saveDto: MenuItemSaveDto): void {
    if (!saveDto) {
      throw Error();
    }

    const name: string = saveDto.name.trim();
    if (!name || name.length < 2 || name.length > 50) {
      throw Error();
    }

    const menuId: number = saveDto.menuId;
    if (!menuId || menuId < 1) {
      throw Error();
    }
  }

  validateUpdateDto(updateDto: MenuItemUpdateDto): void {
    if (!updateDto) {
      throw Error();
    }

    const name: string = updateDto.newName.trim();
    if (!name || name.length < 2 || name.length > 50) {
      throw Error();
    }
  }
}
