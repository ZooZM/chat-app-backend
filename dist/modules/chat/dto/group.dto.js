"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemoveParticipantDto = exports.AddParticipantsDto = exports.CreateGroupDto = void 0;
const class_validator_1 = require("class-validator");
class CreateGroupDto {
    name;
    participants;
    avatarUrl;
}
exports.CreateGroupDto = CreateGroupDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateGroupDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1, { message: 'A group must have at least 1 other participant.' }),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateGroupDto.prototype, "participants", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)(),
    __metadata("design:type", String)
], CreateGroupDto.prototype, "avatarUrl", void 0);
class AddParticipantsDto {
    phoneNumbersToAdd;
}
exports.AddParticipantsDto = AddParticipantsDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1, { message: 'Provide at least 1 phone number to add.' }),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], AddParticipantsDto.prototype, "phoneNumbersToAdd", void 0);
class RemoveParticipantDto {
    phoneNumberToRemove;
}
exports.RemoveParticipantDto = RemoveParticipantDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], RemoveParticipantDto.prototype, "phoneNumberToRemove", void 0);
//# sourceMappingURL=group.dto.js.map