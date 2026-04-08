export {};

declare global {
    namespace Express {
        interface Request {
            authUserId?: string;
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
