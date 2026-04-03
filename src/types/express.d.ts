export {};

declare global {
    namespace Express {
        interface Request {
            admin?: {
                id: number;
                clerkUserId?: string;
                email: string;
                name: string;
                isActive: boolean;
            };
        }
    }
}
