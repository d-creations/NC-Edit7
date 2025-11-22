import { createServiceToken } from './ServiceRegistry';
import { EventBus } from '../services/EventBus';
import { StateService } from '../services/StateService';
import { BackendGateway } from '../services/BackendGateway';
import { MachineService } from '../services/MachineService';
import { ParserService } from '../services/ParserService';

export const EVENT_BUS_TOKEN = createServiceToken<EventBus>('EventBus');
export const STATE_SERVICE_TOKEN = createServiceToken<StateService>('StateService');
export const BACKEND_GATEWAY_TOKEN = createServiceToken<BackendGateway>('BackendGateway');
export const MACHINE_SERVICE_TOKEN = createServiceToken<MachineService>('MachineService');
export const PARSER_SERVICE_TOKEN = createServiceToken<ParserService>('ParserService');
