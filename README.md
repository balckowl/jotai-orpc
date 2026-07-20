# jotai-orpc

English | [日本語](https://github.com/balckowl/jotai-orpc/blob/main/README.ja.md)

Minimal, type-safe [Jotai](https://github.com/pmndrs/jotai) bindings for an
[oRPC](https://github.com/middleapi/orpc) client.

`jotai-orpc` turns oRPC client procedures into standard Jotai atoms. Types for
procedure inputs, outputs, client options, and subscription events are
inferred from the client.

## Install

```sh
npm install jotai-orpc jotai @orpc/client
```

The examples below assume that `client` is your application's typed oRPC
client.

## Query

`atomWithORPCQuery` creates a refreshable asynchronous atom from an oRPC
procedure.

```ts
import { atom } from 'jotai'
import { atomWithORPCQuery } from 'jotai-orpc'

const taskIdAtom = atom('task-1')

const taskAtom = atomWithORPCQuery(client.task.find, (get) => ({
  id: get(taskIdAtom),
}))
```

### Refresh a Query

The Query Atom is writable. Calling its setter runs the same Query again
without changing its input.

```tsx
const refresh = useSetAtom(taskAtom)

refresh()
```

### Disable a Query

Return `DISABLED` from the input factory when the Query should not run:

```ts
import { DISABLED, atomWithORPCQuery } from 'jotai-orpc'

const optionalTaskAtom = atomWithORPCQuery(client.task.find, (get) => {
  const id = get(taskIdAtom)
  return id ? { id } : DISABLED
})
```

While the Query is disabled, its value is `undefined`. Use `disabledOutput` to
provide a different value:

```ts
const optionalTaskAtom = atomWithORPCQuery(
  client.task.find,
  (get) => {
    const id = get(taskIdAtom)
    return id ? { id } : DISABLED
  },
  { disabledOutput: null },
)
```

### Client options

Client options can be derived from atoms:

```ts
const tokenAtom = atom('token')

const taskAtom = atomWithORPCQuery(
  client.task.find,
  (get) => ({ id: get(taskIdAtom) }),
  (get) => ({
    context: { token: get(tokenAtom) },
  }),
)
```

Jotai's cancellation signal is added to the client options automatically. If
you provide a `signal`, it is used instead.

## Mutation

`atomWithORPCMutation` creates a writable atom for executing an oRPC
procedure.

```ts
const updateTaskAtom = atomWithORPCMutation(client.task.update)
```

Use `useSetAtom` to execute the Mutation. Its arguments are passed as a tuple
because an oRPC procedure can accept both input and client options:

```tsx
const updateTask = useSetAtom(updateTaskAtom)

const updatedTask = await updateTask([
  {
    id: 'task-1',
    completed: true,
  },
])
```

The returned Promise resolves to the procedure output. The Mutation Atom also
stores the latest successful output; its value is `null` until the first
successful result:

```tsx
const latestUpdatedTask = useAtomValue(updateTaskAtom)
```

To provide client options for a specific call, pass them as the second tuple
item:

```ts
await updateTask([
  { id: 'task-1', completed: true },
  { context: { token: 'token' } },
])
```

Pass an empty tuple when the procedure has neither input nor client options:

```ts
await runMaintenance([])
```

## Subscription

`atomWithORPCSubscription` creates an atom from an oRPC procedure that returns
an Event Iterator. The atom holds the latest event.

```ts
import { atomWithORPCSubscription } from 'jotai-orpc'

const taskEventsAtom = atomWithORPCSubscription(client.task.events, (get) => ({
  taskId: get(taskIdAtom),
}))
```

The subscription starts when the atom is mounted. It restarts when an atom used
to create its input or options changes. When the subscription atom is
unmounted, it aborts the signal and calls `return()` on the Event Iterator when
available.

```tsx
function LatestTaskEvent() {
  const event = useAtomValue(taskEventsAtom)
  return <p>{event.type}</p>
}
```

## Router-shaped API

Instead of passing each procedure to an atom factory directly,
`createORPCJotai` provides an API that mirrors the shape of the oRPC client.

### Simple form

Pass the client directly for the simplest setup:

```ts
import { createORPCJotai } from 'jotai-orpc'

const orpc = createORPCJotai(client)

const taskAtom = orpc.task.find.atomWithQuery((get) => ({
  id: get(taskIdAtom),
}))

const updateTaskAtom = orpc.task.update.atomWithMutation()
```

Regular oRPC procedures do not carry a Query or Mutation discriminator in
their client type. Therefore, the simple form exposes both `atomWithQuery` and
`atomWithMutation` on regular procedures. Procedures that return an Event
Iterator expose only `atomWithSubscription`.

### Strict form

Tag each procedure to expose only its corresponding atom factory:

```ts
import { createORPCJotai, mutation, query, subscription } from 'jotai-orpc'

const orpc = createORPCJotai({
  task: {
    find: query(client.task.find),
    update: mutation(client.task.update),
    events: subscription(client.task.events),
  },
})

const taskAtom = orpc.task.find.atomWithQuery((get) => ({
  id: get(taskIdAtom),
}))

const updateTaskAtom = orpc.task.update.atomWithMutation()
```

In the strict form, a Query exposes only `atomWithQuery`, a Mutation exposes
only `atomWithMutation`, and a Subscription exposes only
`atomWithSubscription`.

## Dynamic clients

Atoms created through the router-shaped API can select their client from a
Jotai atom. This is useful when switching API endpoints, tenants, or test
clients at runtime.

```ts
import { atom } from 'jotai'
import { createORPCJotai } from 'jotai-orpc'

const clientAtom = atom(client)
const orpc = createORPCJotai(client)

const taskAtom = orpc.task.find.atomWithQuery(
  (get) => ({ id: get(taskIdAtom) }),
  undefined,
  (get) => get(clientAtom),
)

const updateTaskAtom = orpc.task.update.atomWithMutation((get) =>
  get(clientAtom),
)
```

Query and Subscription Atoms react when the client changes. Mutation Atoms use
whichever client is current when the Mutation is executed.

## References

This project was inspired by [jotai-trpc](https://github.com/jotaijs/jotai-trpc).

## License

Distributed under the MIT License. See
[LICENSE](https://github.com/balckowl/jotai-orpc/blob/main/LICENSE) for more
information.
