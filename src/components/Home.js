import { ConnectWallet } from "@thirdweb-dev/react";
import { useAddress, useSigner } from "@thirdweb-dev/react";
import { Client } from "@xmtp/xmtp-js";
import React, { useEffect, useState, useRef } from "react";
import Chat from "./Chat";
import { loadKeys, storeKeys } from "./helpers";

import {
  AttachmentCodec,
  RemoteAttachmentCodec,
} from "xmtp-content-type-remote-attachment";
import styles from "./Home.module.css";

const PEER_ADDRESS = "0x0AD3A479B31072bc14bDE6AaD601e4cbF13e78a8";

export default function Home() {
  const [messages, setMessages] = useState(null);
  const convRef = useRef(null);
  const clientRef = useRef(null);
  const address = useAddress();
  const signer = useSigner();
  const isConnected = !!signer;
  const [xmtpConnected, setXmtpConnected] = useState(false);

  // Function to load the existing messages in a conversation
  const newConversation = async function (xmtp_client, addressTo) {
    //Checks if the address is on the network
    if (xmtp_client.canMessage(addressTo)) {
      //Creates a new conversation with the address
      const conversation = await xmtp_client.conversations.newConversation(
        addressTo,
      );
      convRef.current = conversation;
      //Loads the messages of the conversation
      const messages = await conversation.messages();
      setMessages(messages);
    } else {
      console.log("cant message because is not on the network.");
      //cant message because is not on the network.
    }
  };

  // Function to initialize the XMTP client
  const initXmtp = async function () {
    // Create the XMTP client
    let keys = loadKeys(address);
    if (!keys) {
      keys = await Client.getKeys(signer, {
        // we don't need to publish the contact here since it
        // will happen when we create the client later
        skipContactPublishing: true,
        // we can skip persistence on the keystore for this short-lived
        // instance
        persistConversations: false,
      });
      storeKeys(address, keys);
    }
    const xmtp = await Client.create(null, {
      env: "dev",
      privateKeyOverride: keys,
    });
    // Register the codecs. AttachmentCodec is for local attachments (<1MB)
    xmtp.registerCodec(new AttachmentCodec());
    //RemoteAttachmentCodec is for remote attachments (>1MB) using thirdweb storage
    xmtp.registerCodec(new RemoteAttachmentCodec());
    //Create or load conversation with Gm bot
    newConversation(xmtp, PEER_ADDRESS);
    // Set the XMTP client in state for later use
    setXmtpConnected(!!xmtp.address);
    //Set the client in the ref
    clientRef.current = xmtp;
  };

  useEffect(() => {
    if (isConnected && !xmtpConnected) {
      console.log("Initializing XMTP");
      initXmtp();
    } else if (xmtpConnected && convRef.current) {
      // Function to stream new messages in the conversation
      const streamMessages = async () => {
        const newStream =
          await clientRef.current.conversations.streamAllMessages();
        for await (const msg of newStream) {
          console.log(msg);
          const exists = messages.find((m) => m.id === msg.id);
          if (!exists) {
            setMessages((prevMessages) => {
              const msgsnew = [...prevMessages, msg];
              return msgsnew;
            });
          }
        }
      };
      streamMessages();
    }
  }, [messages, xmtpConnected, isConnected]);

  return (
    <div className={styles.Home}>
      {/* Display the ConnectWallet component if not connected */}
      {!isConnected && (
        <div className={styles.thirdWeb}>
          <ConnectWallet theme="dark" />
        </div>
      )}
      {/* Display XMTP connection options if connected but not initialized */}
      {isConnected && !xmtpConnected && (
        <div className={styles.xmtp}>
          <ConnectWallet theme="light" />
          <button onClick={initXmtp} className={styles.btnXmtp}>
            Connect to XMTP
          </button>
        </div>
      )}
      {/* Render the Chat component if connected, initialized, and messages exist */}
      {isConnected && xmtpConnected && messages && (
        <Chat
          client={clientRef.current}
          conversation={convRef.current}
          messageHistory={messages}
        />
      )}
    </div>
  );
}
