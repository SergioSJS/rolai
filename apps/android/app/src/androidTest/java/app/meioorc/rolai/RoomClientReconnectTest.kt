package app.meioorc.rolai

import androidx.test.ext.junit.runners.AndroidJUnit4
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Instrumented test (criterio de aceite de specs/04-android-overlay.md):
 * o RoomClient reconecta o WebSocket apos perda de conexao, sem backend
 * real — o MockWebServer do OkHttp fala WebSocket e derruba a primeira
 * conexao; a segunda upgrade prova que a reconexao aconteceu.
 *
 * NAO EXECUTADO neste ambiente (sem Android SDK/emulador — ver
 * apps/android/README.md).
 */
@RunWith(AndroidJUnit4::class)
class RoomClientReconnectTest {

    private lateinit var server: MockWebServer

    @Before
    fun setUp() {
        server = MockWebServer()
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun reconectaAposServidorDerrubarAConexao() {
        // 1a conexao: o servidor aceita o upgrade e fecha em seguida
        // (codigo 1012 — service restart; NAO 4404, que e permanente).
        server.enqueue(
            MockResponse().withWebSocketUpgrade(object : WebSocketListener() {
                override fun onOpen(webSocket: WebSocket, response: Response) {
                    webSocket.close(1012, "restart")
                }
            }),
        )
        // 2a conexao: fica aberta — prova de que a reconexao funcionou.
        server.enqueue(MockResponse().withWebSocketUpgrade(object : WebSocketListener() {}))
        server.start()

        val connected = CountDownLatch(2)
        val sawReconnecting = AtomicBoolean(false)
        val client = RoomClient(object : RoomClient.Listener {
            override fun onConnected() {
                connected.countDown()
            }

            override fun onRoll(player: String, resultJson: String) = Unit
            override fun onRoster(memberNames: List<String>) = Unit
            override fun onError(message: String) = Unit

            override fun onDisconnected(reconnecting: Boolean) {
                if (reconnecting) sawReconnecting.set(true)
            }
        })

        val wsUrl = server.url("/rooms/abcd?name=tester").toString()
            .replaceFirst("http://", "ws://")
        client.connect(wsUrl)
        try {
            assertTrue(
                "cliente nao reconectou dentro do prazo",
                connected.await(20, TimeUnit.SECONDS),
            )
            assertTrue("onDisconnected(reconnecting=true) nao foi chamado", sawReconnecting.get())

            // O handshake chegou no servidor com o path/query do protocolo.
            val request = server.takeRequest(5, TimeUnit.SECONDS)
            assertEquals("/rooms/abcd?name=tester", request?.path)
        } finally {
            client.disconnect()
        }
    }

    @Test
    fun naoReconectaQuandoServidorFechaCom4404() {
        // 4404 = sala inexistente (services/backend/app/rooms.py): erro
        // permanente, reconectar seria loop infinito contra o rate limit.
        server.enqueue(
            MockResponse().withWebSocketUpgrade(object : WebSocketListener() {
                override fun onOpen(webSocket: WebSocket, response: Response) {
                    webSocket.close(RoomClient.CLOSE_ROOM_NOT_FOUND, "room not found")
                }
            }),
        )
        server.start()

        val disconnected = CountDownLatch(1)
        val sawReconnecting = AtomicBoolean(false)
        val client = RoomClient(object : RoomClient.Listener {
            override fun onConnected() = Unit
            override fun onRoll(player: String, resultJson: String) = Unit
            override fun onRoster(memberNames: List<String>) = Unit
            override fun onError(message: String) = Unit

            override fun onDisconnected(reconnecting: Boolean) {
                if (reconnecting) sawReconnecting.set(true)
                disconnected.countDown()
            }
        })

        val wsUrl = server.url("/rooms/zzzz?name=tester").toString()
            .replaceFirst("http://", "ws://")
        client.connect(wsUrl)
        try {
            assertTrue(disconnected.await(10, TimeUnit.SECONDS))
            assertTrue("nao deveria tentar reconectar apos 4404", !sawReconnecting.get())
        } finally {
            client.disconnect()
        }
    }
}
