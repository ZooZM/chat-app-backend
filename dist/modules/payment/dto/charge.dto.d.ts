export declare enum PaymentMethod {
    CARD = "CARD",
    WALLET = "WALLET"
}
export declare class ChargeDto {
    email: string;
    amount: number;
    paymentMethod: PaymentMethod;
    pan?: string;
    cvv?: string;
    expiryMonth?: string;
    expiryYear?: string;
    cardholder?: string;
    walletToken?: string;
}
