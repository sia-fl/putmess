import { createClient } from '@clickhouse/client'
import type { NodeClickHouseClientConfigOptions } from '@clickhouse/client/dist/config'
import type { NodeClickHouseClient } from '@clickhouse/client/dist/client'
import Client from 'ioredis'

interface Message {
  user_id: string // String 用户 ID
  title: string // String 消息标题
  message_id: string // String 消息 ID
  message_content: string // String 消息内容
  message_type: string // String
  version?: number // UInt8 版本号 默认 1
  timestamp: string // DateTime DEFAULT now() 消息创建时间（默认当前时间）
}

/**
 * 去除 timestamp 字段
 */
type PutmessOptions = Omit<Message, 'timestamp'>

let clickhouse: NodeClickHouseClient = null as unknown as NodeClickHouseClient

/**
 * 初始化 clickhouse
 *
 * @param options
 */
export function maclickhouse(options: NodeClickHouseClientConfigOptions) {
  clickhouse = createClient(options)
  return clickhouse
}

/**
 * 如果不想初始化，有外部对象可以直接使用就 set
 *
 * @param client
 */
export function setclickhouse(client: NodeClickHouseClient) {
  clickhouse = client
}

let redis: Client = null as unknown as Client

/**
 * 初始化 redis
 *
 * @param url
 */
export function maredis(url: string) {
  redis = new Client(url)
  return redis
}

/**
 * 如果不想初始化，有外部对象可以直接使用就 set
 *
 * @param client
 */
export function setredis(client: Client) {
  redis = client
}

/**
 * 插入消息
 *
 * @param values
 */
export async function putmess(values: PutmessOptions[]) {
  return await clickhouse.insert({
    table: 'message',
    format: 'JSONEachRow',
    values,
  })
}

interface GetmessOptions {
  user_id: string
  page: number
  pageSize: number
}

/**
 * 获取消息
 *
 * @param options
 */
export async function getmessPage(options: GetmessOptions) {
  const resultSet = await clickhouse.query({
    query: `SELECT message_id, title, version FROM message FINAL WHERE user_id = '${options.user_id}' ORDER BY message_id DESC LIMIT ${(options.page - 1) * options.pageSize}, ${options.pageSize}`,
    format: 'JSONEachRow',
  })
  const messes = await resultSet.json() as Pick<Message, 'message_id' | 'title' | 'version'>[]
  /**
   * 将 redis 中已读消息的 message_id 标记为已读
   */
  const readed = await readedmess(options.user_id)
  for (const mess of messes)
    mess.version = readed.includes(mess.message_id) ? 2 : 1

  return messes
}

/**
 * 获取消息
 */
export async function getmess(user_id: string, message_id: string) {
  const resultSet = await clickhouse.query({
    query: `SELECT * FROM message FINAL WHERE user_id = '${user_id}' AND message_id = '${message_id}'`,
    format: 'JSONEachRow',
  })
  const messes = await resultSet.json() as Message[]
  return messes[0]
}

/**
 * 标记消息已读
 *
 * @param user_id
 * @param message_id
 */
export async function putreadedmess(user_id: string, message_id: string) {
  return redis.sadd(`readed:${user_id}`, message_id)
}

/**
 * 获取用户 redis 中已读消息的 message_id
 *
 * @param user_id
 */
export async function readedmess(user_id: string) {
  return redis.smembers(`readed:${user_id}`)
}

/**
 * 同步已读消息
 *
 * @param user_id
 */
export async function syncreadedmess(user_id: string) {
  /**
   * 取出 redis 中已读消息的 message_id
   */
  const readed = await redis.smembers(`readed:${user_id}`)
  const readedStr = readed.map(id => `'${id}'`).join(',')
  const result = await clickhouse.query({
    query: `SELECT * FROM message FINAL WHERE user_id = '${user_id}' AND message_id NOT IN (${readedStr})`,
    format: 'JSONEachRow',
  })
  const messes = await result.json() as Message[]
  await clickhouse.insert({
    table: 'message',
    format: 'JSONEachRow',
    values: messes.map(mess => ({
      user_id: mess.user_id,
      title: mess.title,
      message_id: mess.message_id,
      message_content: mess.message_content,
      message_type: mess.message_type,
      version: 2,
    })),
  })
  /**
   * 清空 redis 中已读消息的 message_id
   */
  await redis.del(`readed:${user_id}`)
}
