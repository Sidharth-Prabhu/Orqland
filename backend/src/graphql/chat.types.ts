import { ObjectType, Field, ID, Int, Float, InputType, registerEnumType } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

@ObjectType()
export class UserProfileGql {
  @Field(() => ID)
  id!: string;

  @Field({ nullable: true })
  firebaseUid?: string;

  @Field()
  name!: string;

  @Field()
  handle!: string;

  @Field()
  email!: string;

  @Field()
  avatar!: string;

  @Field()
  role!: string;

  @Field({ nullable: true })
  location?: string;

  @Field({ nullable: true })
  wsid?: string;

  @Field(() => Boolean, { nullable: true })
  isOnline?: boolean;

  @Field({ nullable: true })
  businessStatus?: string;
}

@ObjectType()
export class LocationDataGql {
  @Field(() => Float)
  latitude!: number;

  @Field(() => Float)
  longitude!: number;

  @Field({ nullable: true })
  label?: string;

  @Field()
  mapUrl!: string;
}

@InputType()
export class LocationDataInputGql {
  @Field(() => Float)
  @IsNumber()
  latitude!: number;

  @Field(() => Float)
  @IsNumber()
  longitude!: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  label?: string;

  @Field()
  @IsString()
  mapUrl!: string;
}

@ObjectType()
export class ChatAttachmentGql {
  @Field(() => ID)
  id!: string;

  @Field()
  type!: string;

  @Field()
  name!: string;

  @Field()
  url!: string;

  @Field({ nullable: true })
  downloadUrl?: string;

  @Field({ nullable: true })
  thumbnailUrl?: string;

  @Field(() => Int, { nullable: true })
  size?: number;

  @Field({ nullable: true })
  mimeType?: string;

  @Field(() => Float)
  uploadedAt!: number;

  @Field(() => Float)
  expiresAt!: number;

  @Field(() => Boolean, { nullable: true })
  isExpired?: boolean;

  @Field(() => LocationDataGql, { nullable: true })
  locationData?: LocationDataGql;
}

@InputType()
export class ChatAttachmentInputGql {
  @Field(() => ID)
  @IsString()
  id!: string;

  @Field()
  @IsString()
  type!: string;

  @Field()
  @IsString()
  name!: string;

  @Field()
  @IsString()
  url!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  downloadUrl?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  size?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @Field(() => Float)
  @IsNumber()
  uploadedAt!: number;

  @Field(() => Float)
  @IsNumber()
  expiresAt!: number;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  isExpired?: boolean;

  @Field(() => LocationDataInputGql, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDataInputGql)
  locationData?: LocationDataInputGql;
}

@ObjectType()
export class ChatMessageGql {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  conversationId!: string;

  @Field(() => ID)
  senderId!: string;

  @Field({ nullable: true })
  senderEmail?: string;

  @Field()
  senderName!: string;

  @Field()
  senderAvatar!: string;

  @Field()
  content!: string;

  @Field()
  timestamp!: string;

  @Field()
  date!: string;

  @Field(() => Float)
  createdAt!: number;

  @Field(() => Int, { nullable: true })
  sequenceNumber?: number;

  @Field({ nullable: true })
  idempotencyKey?: string;

  @Field(() => Boolean, { nullable: true })
  isMe?: boolean;

  @Field({ nullable: true })
  status?: string;

  @Field(() => ChatAttachmentGql, { nullable: true })
  attachment?: ChatAttachmentGql;

  @Field(() => [ChatAttachmentGql], { nullable: true })
  attachments?: ChatAttachmentGql[];

  @Field(() => Boolean, { nullable: true })
  deletedByBusiness?: boolean;

  @Field(() => Boolean, { nullable: true })
  deletedByClient?: boolean;

  @Field(() => Boolean, { nullable: true })
  deletedForEveryone?: boolean;

  @Field(() => Boolean, { nullable: true })
  isEdited?: boolean;

  @Field(() => Float, { nullable: true })
  editedAt?: number;
}

@ObjectType()
export class ConversationParticipantGql {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  handle?: string;

  @Field()
  avatar!: string;

  @Field(() => Boolean)
  isOnline!: boolean;

  @Field()
  role!: string;

  @Field(() => Float, { nullable: true })
  joinedAt?: number;

  @Field({ nullable: true })
  lastReadMessageId?: string;

  @Field(() => Float, { nullable: true })
  lastReadAt?: number;
}

@ObjectType()
export class WorkspaceInfoGql {
  @Field()
  name!: string;

  @Field()
  type!: string;

  @Field()
  description!: string;
}

@ObjectType()
export class BookingInfoGql {
  @Field({ nullable: true })
  serviceName?: string;

  @Field({ nullable: true })
  status?: string;
}

@ObjectType()
export class ConversationGql {
  @Field(() => ID)
  id!: string;

  @Field(() => ID, { nullable: true })
  orqspaceId?: string;

  @Field(() => ID)
  clientId!: string;

  @Field()
  clientEmail!: string;

  @Field()
  clientName!: string;

  @Field()
  clientAvatar!: string;

  @Field(() => ID)
  businessId!: string;

  @Field()
  businessEmail!: string;

  @Field()
  businessName!: string;

  @Field()
  businessAvatar!: string;

  @Field(() => ConversationParticipantGql)
  participant!: ConversationParticipantGql;

  @Field()
  status!: string;

  @Field(() => Float, { nullable: true })
  endedAt?: number;

  @Field({ nullable: true })
  endedBy?: string;

  @Field(() => Boolean, { nullable: true })
  deletedByBusiness?: boolean;

  @Field(() => Float, { nullable: true })
  businessDeletedAt?: number;

  @Field(() => Float, { nullable: true })
  clientDeletedAt?: number;

  @Field(() => Boolean, { nullable: true })
  deletedForClient?: boolean;

  @Field()
  lastMessage!: string;

  @Field()
  lastMessageTime!: string;

  @Field(() => Float, { nullable: true })
  lastMessageTimestamp?: number;

  @Field(() => Int)
  unreadCount!: number;

  @Field(() => Int, { nullable: true })
  unreadByClient?: number;

  @Field(() => Int, { nullable: true })
  unreadByBusiness?: number;

  @Field(() => WorkspaceInfoGql)
  workspaceInfo!: WorkspaceInfoGql;

  @Field(() => BookingInfoGql, { nullable: true })
  bookingInfo?: BookingInfoGql;

  @Field(() => [ChatMessageGql])
  messages!: ChatMessageGql[];
}

@ObjectType()
export class PaginatedMessagesGql {
  @Field(() => [ChatMessageGql])
  messages!: ChatMessageGql[];

  @Field(() => Boolean)
  hasMore!: boolean;

  @Field({ nullable: true })
  nextCursor?: string;
}

@ObjectType()
export class SignedUploadPolicyGql {
  @Field()
  uploadUrl!: string;

  @Field()
  downloadUrl!: string;

  @Field()
  key!: string;

  @Field({ nullable: true })
  objectKey?: string;

  @Field({ nullable: true })
  attachmentId?: string;

  @Field(() => Float)
  expiresAt!: number;

  @Field(() => Int, { nullable: true })
  expiresInSeconds?: number;
}

@ObjectType()
export class HeartbeatResultGql {
  @Field(() => Boolean)
  success!: boolean;

  @Field(() => Float)
  timestamp!: number;
}

@InputType()
export class InitiateConversationInputGql {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  businessId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  businessEmail?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  businessName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  businessAvatar?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  workspaceName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  category?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  initialMessage?: string;
}

@InputType()
export class SendMessageInputGql {
  @Field(() => ID)
  @IsString()
  conversationId!: string;

  @Field()
  @IsString()
  content!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @Field(() => ChatAttachmentInputGql, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => ChatAttachmentInputGql)
  attachment?: ChatAttachmentInputGql;

  @Field(() => [ChatAttachmentInputGql], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatAttachmentInputGql)
  attachments?: ChatAttachmentInputGql[];
}

@InputType()
export class EditMessageInputGql {
  @Field(() => ID)
  @IsString()
  conversationId!: string;

  @Field(() => ID)
  @IsString()
  messageId!: string;

  @Field()
  @IsString()
  content!: string;
}

@InputType()
export class DeleteMessageInputGql {
  @Field(() => ID)
  @IsString()
  conversationId!: string;

  @Field(() => ID)
  @IsString()
  messageId!: string;
}

@InputType()
export class ReopenConversationInputGql {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  workspaceName?: string;
}

@InputType()
export class RequestSignedUploadInputGql {
  @Field(() => ID)
  @IsString()
  conversationId!: string;

  @Field()
  @IsString()
  fileName!: string;

  @Field()
  @IsString()
  mimeType!: string;

  @Field(() => Int)
  @IsNumber()
  size!: number;
}

@ObjectType()
export class OrqspaceGql {
  @Field(() => ID)
  id!: string;

  @Field()
  orqspaceCode!: string;

  @Field()
  name!: string;

  @Field({ nullable: true })
  logoUrl?: string;

  @Field(() => ID)
  ownerId!: string;

  @Field(() => Boolean)
  isActive!: boolean;

  @Field({ nullable: true })
  category?: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  email?: string;
}

@InputType()
export class RegisterPushTokenInputGql {
  @Field()
  @IsString()
  token!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  platform?: string;
}

@InputType()
export class RemovePushTokenInputGql {
  @Field()
  @IsString()
  token!: string;
}

@InputType()
export class ClearConversationHistoryInputGql {
  @Field(() => ID)
  @IsString()
  conversationId!: string;
}
