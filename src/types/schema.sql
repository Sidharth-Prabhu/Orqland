-- PostgreSQL Schema for Orqland Chat & Booking Platform
-- Architecture: Next.js + NestJS + PostgreSQL

-- Users table (supports both Clients and Businesses)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role VARCHAR(20) NOT NULL CHECK (role IN ('client', 'business')),
    name VARCHAR(255) NOT NULL,
    handle VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    avatar_url TEXT,
    location VARCHAR(255),
    wsid VARCHAR(100),
    business_status VARCHAR(20) DEFAULT 'Open' CHECK (business_status IN ('Open', 'Closed')),
    is_online BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Workspaces or Orqspaces
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) DEFAULT 'Orqspace',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Conversations between a client and a business
-- Lifecycle:
--  - Only business can initiate conversation
--  - status: 'active' or 'ended'
--  - Delete Chat: sets deleted_by_business_at (clears business view; client history preserved; connection stays active)
--  - End Chat: sets status = 'ended', ended_at, deleted_for_client_at (closes connection; prevents future messages; clears client history)
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
    ended_at TIMESTAMP WITH TIME ZONE,
    ended_by UUID REFERENCES users(id),
    deleted_by_business_at TIMESTAMP WITH TIME ZONE,
    deleted_for_client_at TIMESTAMP WITH TIME ZONE,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (client_id, business_id)
);

-- Chat Messages
-- Attachments:
--  - Only 'image' (jpg, jpeg, png, webp) or 'pdf' or 'location'
--  - 48-Hour Retention: attachment_expires_at = created_at + INTERVAL '48 hours'
--  - Delivery Status: 'sending', 'sent', 'delivered', 'read', 'failed'
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'sent' CHECK (status IN ('sending', 'sent', 'delivered', 'read', 'failed')),
    attachment_type VARCHAR(20) CHECK (attachment_type IN ('image', 'pdf', 'location')),
    attachment_name VARCHAR(255),
    attachment_url TEXT,
    attachment_size INTEGER,
    attachment_mime_type VARCHAR(100),
    attachment_uploaded_at TIMESTAMP WITH TIME ZONE,
    attachment_expires_at TIMESTAMP WITH TIME ZONE,
    attachment_is_deleted BOOLEAN DEFAULT false,
    location_latitude DOUBLE PRECISION,
    location_longitude DOUBLE PRECISION,
    location_label VARCHAR(255),
    location_map_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bookings associated with conversations / clients
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    service_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'Processing' CHECK (status IN ('Processing', 'Confirmed', 'Completed', 'Cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance and quick query lookup
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_client_id ON conversations(client_id);
CREATE INDEX IF NOT EXISTS idx_conversations_business_id ON conversations(business_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_messages_attachment_expires ON messages(attachment_expires_at) WHERE attachment_is_deleted = false;
