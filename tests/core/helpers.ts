import { createHash, randomInt } from 'crypto';
import { expect, Page } from '@playwright/test';
import {
  attendeePW, fullName, moderatorPW, secret, server,
} from './parameters';
import { InitParameters } from './sessionPage';

declare global {
  interface Window {
    meetingClientSettings: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      public: any;
    };
  }
}

interface GetJoinURLParams {
  meetingID: string;
  isModerator: boolean;
  joinParameter?: string;
  skipSessionDetailsModal?: boolean;
}

export interface SessionSettings {
  autoJoinAudioModal: boolean;
}

const MEETING_ID_MIN = 1000000;
const MEETING_ID_MAX = 10000000;

function getChecksum(text: string): string {
  const requested = (process.env.CHECKSUM || '').toLowerCase();
  if (['sha1', 'sha256', 'sha512'].includes(requested)) {
    return createHash(requested).update(text).digest('hex');
  }
  // The secret's length tells which algorithm the server expects.
  const byLength: Record<number, string> = { 128: 'sha512', 64: 'sha256' };
  const algorithm = byLength[secret?.length ?? 0] ?? 'sha1';
  return createHash(algorithm).update(text).digest('hex');
}

function apiUrl(call: string, query: string): string {
  return `${server}api/${call}?${query}&checksum=${getChecksum(`${call}${query}${secret}`)}`;
}

function readXmlTag(xml: string, tag: string): string | undefined {
  return xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1];
}

/**
 * Creates a meeting. `modulesXml`, when given, is sent as the POST body — that is how a
 * presentation is uploaded with the create call without hosting it anywhere.
 */
export async function createMeeting(
  params: InitParameters,
  createParameter?: string,
  modulesXml?: string,
): Promise<string> {
  const meetingID = `random-${randomInt(MEETING_ID_MIN, MEETING_ID_MAX)}`;
  const baseQuery = `name=${meetingID}&meetingID=${meetingID}&attendeePW=${params.attendeePW}`
    + `&moderatorPW=${params.moderatorPW}&welcome=${params.welcome}`;
  const query = createParameter ? `${baseQuery}&${createParameter}` : baseQuery;

  const response = await fetch(apiUrl('create', query), modulesXml
    ? { method: 'POST', body: modulesXml, headers: { 'Content-Type': 'application/xml' } }
    : undefined);
  const xml = await response.text();
  expect(response.status, 'create call should answer 200').toEqual(200);
  expect(readXmlTag(xml, 'returncode'), `create call should succeed: ${readXmlTag(xml, 'message')}`).toEqual('SUCCESS');
  return readXmlTag(xml, 'meetingID') as string;
}

export function getJoinURL({
  meetingID, isModerator, joinParameter, skipSessionDetailsModal,
}: GetJoinURLParams): string {
  const pw = isModerator ? moderatorPW : attendeePW;
  // default value in settings.yml is true
  const skipDetails = skipSessionDetailsModal ? '&userdata-bbb_show_session_details_on_join=false' : '';
  const baseQuery = `fullName=${fullName}&meetingID=${meetingID}&password=${pw}${skipDetails}`;
  const query = joinParameter ? `${baseQuery}&${joinParameter}` : baseQuery;
  return apiUrl('join', query);
}

export function encodeCustomParams(param: string): string {
  const [key, ...rest] = param.split('=');
  return `${key}=${encodeURIComponent(rest.join('=')).replace(/%20/g, '+')}`;
}

export function presentationModulesXml(fileName: string, pdf: Buffer): string {
  return '<modules><module name="presentation">'
    + `<document name="${fileName}">${pdf.toString('base64')}</document>`
    + '</module></modules>';
}

export async function generateSettingsData(page: Page): Promise<SessionSettings> {
  const settingsData = await page.evaluate(() => window.meetingClientSettings.public);
  return { autoJoinAudioModal: settingsData.app?.autoJoin };
}
