export interface GameModuleDescriptor<TGameId extends string = string> {
  readonly id: TGameId;
  readonly displayName: string;
}

export interface GameCommand<
  TType extends string = string,
  TPayload extends Record<string, unknown> = Record<string, unknown>
> {
  type: TType;
  actorPlayerId: string;
  payload: TPayload;
}

export interface GameModule<
  TState,
  TCommand,
  TCreateContext,
  THandleContext,
  TProjectionContext,
  TProjection,
  TTickContext,
  TUpdate,
  TGameId extends string = string
> extends GameModuleDescriptor<TGameId> {
  create(state: TState, context: TCreateContext): TUpdate;
  handle(state: TState, command: TCommand, context: THandleContext): TUpdate;
  project(state: TState, context: TProjectionContext): TProjection;
  tick(state: TState, context: TTickContext): TUpdate | undefined;
  migrate(value: unknown): TState;
  validate(state: TState): void;
}

export class GameRegistry<
  TGameId extends string,
  TModule extends GameModuleDescriptor<TGameId>
> {
  readonly #modules = new Map<TGameId, TModule>();

  constructor(modules: readonly TModule[] = []) {
    for (const module of modules) this.register(module);
  }

  register(module: TModule): void {
    if (this.#modules.has(module.id)) {
      throw new Error(`游戏模块已注册: ${module.id}`);
    }
    this.#modules.set(module.id, module);
  }

  has(id: TGameId): boolean {
    return this.#modules.has(id);
  }

  get(id: TGameId): TModule {
    const module = this.#modules.get(id);
    if (!module) throw new Error(`游戏模块未开放: ${id}`);
    return module;
  }

  list(): readonly TModule[] {
    return [...this.#modules.values()];
  }
}
