/** Client -> Gateway request */
export interface GatewayRequest {
  type: 'req'
  id: string
  method: string
  params?: Record<string, unknown>
}

/** Gateway -> Client response */
export interface GatewayResponse {
  type: 'res'
  id: string
  ok: boolean
  payload?: unknown
  error?: { code: number; message: string }
}

/** Gateway -> Client event */
export interface GatewayEvent {
  type: 'event'
  event: string
  payload: unknown
}

export type GatewayOutMessage = GatewayResponse | GatewayEvent

export enum GatewayErrorCode {
  METHOD_NOT_FOUND = 4001,
  INVALID_PARAMS = 4002,
  INTERNAL_ERROR = 5000
}

export interface MethodContext {
  clientId: string
  gateway: GatewayApi
}

export type MethodHandler = (
  params: Record<string, unknown>,
  ctx: MethodContext
) => Promise<unknown>

export interface MethodGroup {
  namespace: string
  methods: Record<string, MethodHandler>
}

export interface GatewayApi {
  broadcastEvent(event: string, payload: unknown): void
}
