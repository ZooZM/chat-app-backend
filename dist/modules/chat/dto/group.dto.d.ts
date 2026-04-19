export declare class CreateGroupDto {
    name: string;
    participants: string[];
    avatarUrl?: string;
}
export declare class AddParticipantsDto {
    phoneNumbersToAdd: string[];
}
export declare class RemoveParticipantDto {
    phoneNumberToRemove: string;
}
