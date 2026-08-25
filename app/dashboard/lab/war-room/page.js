// app/dashboard/lab/war-room/page.js — MY CHEW WAR ROOM.
//
// The intelligence aggregator: Mission, Current Position, Plan Status,
// Next Best Move, Active Barriers, What CHEW Is Watching, Completed/
// Pending Moves, Evidence, and Plan Changes — built now, using only
// verified existing data, per the directive: "the containers themselves
// do not [need more data]." Every field here already exists elsewhere in
// the portal; this page is a different lens on the same reconciled state,
// not a new data source. Gated by app/dashboard/lab/layout.js (Accepted).
//
// Today only Credit contributes real data — a client with no Credit
// activity yet sees an honest "nothing to show" state, not a fabricated
// War Room. A second room's reconciled intelligence joins the same
// `rooms` array once it exists (see lib/intelligenceCore.js).

import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import LockedFeatureCard from '../../../components/lab/LockedFeatureCard';
import RecommendationExplainer from '../../../components/lab/RecommendationExplainer';
import { IconFlask, IconChevronRight } from '../../../components/icons';
import Link from 'next/link';
import { reconcileHomeIntelligence, getRecommendationHistory } from '../../../../lib/intelligenceCore';
import { countEvents } from '../../../../lib/events';
import { getFeatureAccess } from '../../../../lib/features';
import { STATUS_LABELS } from '../../../../lib/featureCopy';

const ROOM_LABELS = { credit: 'Credit' };

function RoomWarRoom({ roomIntel, history, completedMoves }) {
  const pendingMoves = Object.values(roomIntel.counts).reduce((a, b) => a + b, 0) + roomIntel.activeBarriers.length;

  return (
    <div className="card" style={{ marginBottom: '24px' }}>
      <div className="flex-between" style={{ marginBottom: '16px' }}>
        <h2 style={{ margin: 0 }}>{ROOM_LABELS[roomIntel.room] ?? roomIntel.room}</h2>
        <span className="badge badge-pending">
          {{ on_track: 'On Track', watch: 'Watch', action_needed: 'Action Needed', plan_at_risk: 'Plan at Risk' }[roomIntel.planStatus] ?? 'Not Started'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '18px', marginBottom: '18px' }}>
        <div>
          <span className="text-faint" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Mission</span>
          <div style={{ fontSize: '1rem', marginTop: '4px' }}>
            {roomIntel.scorePath ? `Reach a ${roomIntel.scorePath.target}+ credit profile` : 'No target set yet'}
          </div>
        </div>
        <div>
          <span className="text-faint" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Current Position</span>
          <div style={{ fontSize: '1rem', marginTop: '4px' }}>
            {roomIntel.scorePath ? roomIntel.scorePath.current : 'Not logged yet'}
          </div>
        </div>
        <div>
          <span className="text-faint" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Completed Moves</span>
          <div style={{ fontSize: '1rem', marginTop: '4px' }}>{completedMoves}</div>
        </div>
        <div>
          <span className="text-faint" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pending Moves</span>
          <div style={{ fontSize: '1rem', marginTop: '4px' }}>{pendingMoves}</div>
        </div>
      </div>

      {roomIntel.nextBestMove && (
        <div style={{ marginBottom: '18px' }}>
          <span className="text-faint" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Next Best Move</span>
          <p style={{ margin: '4px 0 0', fontWeight: 600 }}>{roomIntel.nextBestMove.action}</p>
          <RecommendationExplainer recommendation={roomIntel.recommendation} />
        </div>
      )}

      {roomIntel.chewNoticed.length > 0 && (
        <div style={{ marginBottom: '18px' }}>
          <span className="text-faint" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>CHEW Noticed</span>
          <ul style={{ paddingLeft: '18px', marginTop: '6px', fontSize: '0.88rem' }}>
            {roomIntel.chewNoticed.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      )}

      {roomIntel.activeBarriers.length > 0 && (
        <div style={{ marginBottom: '18px' }}>
          <span className="text-faint" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Active Barrier{roomIntel.activeBarriers.length === 1 ? '' : 's'}</span>
          {roomIntel.activeBarriers.map((b) => (
            <p key={b.id} style={{ margin: '6px 0 0', fontSize: '0.88rem' }}>{b.whatHappened}</p>
          ))}
        </div>
      )}

      <div style={{ marginBottom: '18px' }}>
        <span className="text-faint" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>What CHEW Is Watching</span>
        <ul style={{ paddingLeft: '18px', marginTop: '6px', fontSize: '0.88rem' }}>
          {roomIntel.activeBarriers.length > 0
            ? roomIntel.activeBarriers.map((b) => <li key={b.id}>{b.recheckTrigger}</li>)
            : <li>Your next flagged item, generated letter, or logged score update.</li>}
        </ul>
      </div>

      <div style={{ marginBottom: '18px' }}>
        <span className="text-faint" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Evidence</span>
        <p style={{ margin: '4px 0 0', fontSize: '0.88rem' }} className="text-faint">Coming once the Evidence Vault ships.</p>
      </div>

      {history.length > 0 && (
        <div>
          <span className="text-faint" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Plan Changes</span>
          <ul style={{ paddingLeft: '18px', marginTop: '6px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {history.map((h) => (
              <li key={h.id}>
                {new Date(h.createdAt).toLocaleDateString()} — {h.actionText}
                {h.status === 'superseded' && <span className="text-faint"> (superseded)</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default async function WarRoomPage() {
  const { user, hasAccess, feature } = await getFeatureAccess('war_room');
  if (!hasAccess) {
    return (
      <>
        <PageHeader eyebrow="The Lab" title="My CHEW War Room" description="A command-center view of your plan." />
        <LockedFeatureCard
          icon={<IconFlask />}
          name={feature?.name ?? 'My CHEW War Room'}
          description={feature?.description ?? 'A command-center view of your plan is coming to CHEW.'}
          statusLabel={STATUS_LABELS[feature?.status] ?? STATUS_LABELS.locked}
        />
      </>
    );
  }

  const homeIntelligence = await reconcileHomeIntelligence(user.id);
  const roomsWithData = homeIntelligence.rooms.filter((r) => r.planStatus !== null || r.counts.unattested > 0);

  const roomsWithHistory = await Promise.all(
    roomsWithData.map(async (roomIntel) => ({
      roomIntel,
      history: await getRecommendationHistory(user.id, roomIntel.room, 8),
      completedMoves: await countEvents(user.id, roomIntel.room),
    }))
  );

  return (
    <>
      <PageHeader
        eyebrow="The Lab"
        title="My CHEW War Room"
        description="Your mission, your position, and what CHEW is watching — one command center, pulled from what you've actually done."
      />

      {roomsWithHistory.length === 0 ? (
        <EmptyState
          icon={<IconFlask />}
          title="Nothing to show yet"
          description="Your War Room fills in as you use a room — flag your first item in Credit to get started."
          action={
            <Link href="/dashboard/lab/credit" className="btn btn-gold btn-sm">
              Go to Credit <IconChevronRight />
            </Link>
          }
        />
      ) : (
        roomsWithHistory.map(({ roomIntel, history, completedMoves }) => (
          <RoomWarRoom key={roomIntel.room} roomIntel={roomIntel} history={history} completedMoves={completedMoves} />
        ))
      )}
    </>
  );
}
