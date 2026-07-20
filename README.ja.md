# jotai-orpc

[English](https://github.com/balckowl/jotai-orpc/blob/main/README.md) | 日本語

[oRPC](https://github.com/middleapi/orpc)クライアント向けの、最小限で型安全な[Jotai](https://github.com/pmndrs/jotai)バインディングです。

`jotai-orpc`は、oRPCクライアントのProcedureを標準的なJotai Atomへ変換します。Procedureの入力・出力、クライアントオプション、Subscriptionイベントの型は、クライアントから推論されます。

## インストール

```sh
npm install jotai-orpc jotai @orpc/client
```

以降の例では、`client`がアプリケーションの型付きoRPCクライアントであるとします。

## Query

`atomWithORPCQuery`は、oRPC Procedureから再取得可能な非同期Atomを作成します。

```ts
import { atom } from 'jotai'
import { atomWithORPCQuery } from 'jotai-orpc'

const taskIdAtom = atom('task-1')

const taskAtom = atomWithORPCQuery(client.task.find, (get) => ({
  id: get(taskIdAtom),
}))
```

### Queryを再取得する

Query Atomは書き込み可能です。Setterを呼び出すと、入力を変更せずに同じQueryを再実行できます。

```tsx
const refresh = useSetAtom(taskAtom)

refresh()
```

### Queryを無効化する

Queryを実行しない場合は、入力を生成する関数から`DISABLED`を返します。

```ts
import { DISABLED, atomWithORPCQuery } from 'jotai-orpc'

const optionalTaskAtom = atomWithORPCQuery(client.task.find, (get) => {
  const id = get(taskIdAtom)
  return id ? { id } : DISABLED
})
```

Queryが無効な間、その値は`undefined`になります。別の値を返したい場合は、`disabledOutput`で指定できます。

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

### クライアントオプション

クライアントオプションはAtomから動的に生成できます。

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

Jotaiのキャンセル用Signalは、クライアントオプションへ自動的に追加されます。独自の`signal`を指定した場合は、そちらが使用されます。

## Mutation

`atomWithORPCMutation`は、oRPC Procedureを実行するための書き込み可能なAtomを作成します。

```ts
const updateTaskAtom = atomWithORPCMutation(client.task.update)
```

Mutationは`useSetAtom`を使って実行します。oRPC Procedureは入力とクライアントオプションの両方を受け取れるため、引数はタプルとして渡します。

```tsx
const updateTask = useSetAtom(updateTaskAtom)

const updatedTask = await updateTask([
  {
    id: 'task-1',
    completed: true,
  },
])
```

返されたPromiseは、Procedureの出力で解決されます。また、Mutation Atomには直近で成功した出力が保存され、最初に成功するまでは`null`になります。

```tsx
const latestUpdatedTask = useAtomValue(updateTaskAtom)
```

特定の呼び出しにクライアントオプションを指定する場合は、タプルの2番目の要素として渡します。

```ts
await updateTask([
  { id: 'task-1', completed: true },
  { context: { token: 'token' } },
])
```

入力もクライアントオプションもないProcedureには、空のタプルを渡します。

```ts
await runMaintenance([])
```

## Subscription

`atomWithORPCSubscription`は、Event Iteratorを返すoRPC ProcedureからAtomを作成します。このAtomには最新のイベントが保存されます。

```ts
import { atomWithORPCSubscription } from 'jotai-orpc'

const taskEventsAtom = atomWithORPCSubscription(client.task.events, (get) => ({
  taskId: get(taskIdAtom),
}))
```

Atomがマウントされると購読を開始します。入力やオプションの生成に使うAtomが変化すると、購読をやり直します。Subscription AtomがアンマウントされるとSignalをabortし、Event Iteratorに`return()`があれば呼び出して購読を終了します。

```tsx
function LatestTaskEvent() {
  const event = useAtomValue(taskEventsAtom)
  return <p>{event.type}</p>
}
```

## Router形式のAPI

ProcedureをAtom Factoryへ個別に渡す代わりに、`createORPCJotai`を使うとoRPCクライアントと同じ構造を持つAPIを作成できます。

### シンプルな形式

最も簡単に利用するには、クライアントをそのまま渡します。

```ts
import { createORPCJotai } from 'jotai-orpc'

const orpc = createORPCJotai(client)

const taskAtom = orpc.task.find.atomWithQuery((get) => ({
  id: get(taskIdAtom),
}))

const updateTaskAtom = orpc.task.update.atomWithMutation()
```

通常のoRPC Procedureのクライアント型には、QueryとMutationを区別する情報がありません。そのため、シンプルな形式では通常のProcedureに`atomWithQuery`と`atomWithMutation`の両方が表示されます。Event Iteratorを返すProcedureには`atomWithSubscription`だけが表示されます。

### 厳密な形式

各Procedureにタグを付けると、対応するAtom Factoryだけが型に表示されます。

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

厳密な形式では、Queryには`atomWithQuery`、Mutationには`atomWithMutation`、Subscriptionには`atomWithSubscription`だけが表示されます。

## 動的なクライアント

Router形式のAPIで作成したAtomは、使用するクライアントをJotai Atomから選択できます。APIエンドポイント、テナント、テスト用クライアントなどを実行時に切り替える場合に便利です。

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

Query AtomとSubscription Atomは、クライアントの変更に追従します。Mutation Atomは、Mutationを実行した時点のクライアントを使用します。

## References

[jotai-trpc](https://github.com/jotaijs/jotai-trpc)を参考にさせていただきました。

## License

MIT Licenseの下で配布されています。詳細は[LICENSE](https://github.com/balckowl/jotai-orpc/blob/main/LICENSE)をご覧ください。
