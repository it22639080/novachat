import { Prisma, prisma } from "@novachat/database";
import {
  BufferJSON,
  initAuthCreds,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataSet,
  type SignalDataTypeMap
} from "@whiskeysockets/baileys";
import { decryptSessionState, encryptSessionState } from "../crypto/session-crypto.js";

type StoredSignalKeys = {
  [T in keyof SignalDataTypeMap]?: Record<string, SignalDataTypeMap[T]>;
};

type StoredAuthState = {
  creds: AuthenticationCreds;
  keys: StoredSignalKeys;
};

function encodeState(state: StoredAuthState) {
  return JSON.parse(JSON.stringify(state, BufferJSON.replacer)) as Prisma.InputJsonValue;
}

function decodeState(value: unknown): StoredAuthState {
  return JSON.parse(JSON.stringify(value), BufferJSON.reviver) as StoredAuthState;
}

export class WhatsAppWebAuthStore {
  private state: StoredAuthState;

  private constructor(
    private readonly tenantId: string,
    private readonly connectionId: string,
    initialState: StoredAuthState
  ) {
    this.state = initialState;
  }

  static async create(tenantId: string, connectionId: string) {
    const session = await prisma.whatsAppWebSession.findFirstOrThrow({
      where: { id: connectionId, tenantId, deletedAt: null }
    });

    const state = session.encryptedSessionState
      ? decodeState(decryptSessionState<unknown>(session.encryptedSessionState))
      : {
          creds: initAuthCreds(),
          keys: {}
        };

    return new WhatsAppWebAuthStore(tenantId, connectionId, state);
  }

  get authenticationState(): AuthenticationState {
    return {
      creds: this.state.creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
          const bucket = (this.state.keys[type] ?? {}) as Record<string, SignalDataTypeMap[T]>;
          const result: { [id: string]: SignalDataTypeMap[T] } = {};

          for (const id of ids) {
            const value = bucket[id];
            if (value) {
              result[id] = value;
            }
          }

          return result;
        },
        set: async (data: SignalDataSet) => {
          for (const [type, values] of Object.entries(data) as Array<
            [keyof SignalDataTypeMap, Record<string, SignalDataTypeMap[keyof SignalDataTypeMap] | null>]
          >) {
            const bucket = (this.state.keys[type] ??= {});
            for (const [id, value] of Object.entries(values)) {
              if (value === null) {
                delete bucket[id];
              } else {
                bucket[id] = value as never;
              }
            }
          }

          await this.save();
        },
        clear: async () => {
          this.state.keys = {};
          await this.save();
        }
      }
    };
  }

  async updateCredentials(update: Partial<AuthenticationCreds>) {
    this.state.creds = {
      ...this.state.creds,
      ...update
    };
    await this.save();
  }

  async delete() {
    this.state = {
      creds: initAuthCreds(),
      keys: {}
    };
    await prisma.whatsAppWebSession.update({
      where: { id: this.connectionId },
      data: {
        encryptedSessionState: null,
        sessionKeyVersion: 1
      }
    });
  }

  private async save() {
    await prisma.whatsAppWebSession.updateMany({
      where: {
        id: this.connectionId,
        tenantId: this.tenantId,
        deletedAt: null
      },
      data: {
        encryptedSessionState: encryptSessionState(encodeState(this.state)),
        sessionKeyVersion: 1
      }
    });
  }
}
