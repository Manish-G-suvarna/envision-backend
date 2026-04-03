import { io } from '../server';

export const emitEventUpdate = (data: any) => {
    console.log('📡 Broadcasting event update to all clients');
    io.emit('events_updated', data);
};

export const emitRegistrationUpdate = (id: number, status: string) => {
    console.log(`📡 Broadcasting registration update for ID ${id}: ${status}`);
    io.emit('registration_updated', { id, status });
};

export const emitNewRegistration = (registration: any) => {
    console.log('📡 Broadcasting new registration alert');
    io.emit('new_registration', registration);
};
